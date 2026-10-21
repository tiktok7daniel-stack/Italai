package app.dillo.italiano

import android.app.ActivityManager
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.ResponseFormat
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Runs an on-device Gemma model with LiteRT-LM: downloads the model file once (DownloadManager),
 * loads it (GPU first, CPU fallback) and generates text, streaming tokens to the web layer.
 */
@CapacitorPlugin(name = "LocalBrain")
class LocalBrainPlugin : Plugin() {
  private val worker = Executors.newSingleThreadExecutor()
  private var engine: Engine? = null
  private var loadedFile: String? = null
  private var loadedBackend: String? = null
  private val busy = AtomicBoolean(false)
  private var active: Conversation? = null

  private fun modelsDir(): File = File(context.getExternalFilesDir(null), "models").apply { mkdirs() }

  private fun prefs() = context.getSharedPreferences("local_brain", Context.MODE_PRIVATE)

  private fun downloads() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  @PluginMethod
  fun deviceInfo(call: PluginCall) {
    val memory = ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
    val free = StatFs(modelsDir().path).availableBytes
    call.resolve(JSObject().put("totalRam", memory.totalMem.toDouble()).put("freeStorage", free.toDouble()))
  }

  /** Download state of one model file: done, downloading (with bytes), failed or absent. */
  @PluginMethod
  fun status(call: PluginCall) {
    val file = call.getString("file") ?: return call.reject("file is required")
    val size = call.getDouble("size")?.toLong() ?: 0L
    val target = File(modelsDir(), file)
    val result = JSObject().put("file", file).put("loaded", loadedFile == file).put("backend", loadedBackend)
    val id = prefs().getLong("dl_$file", -1L)
    if (id >= 0) {
      downloads().query(DownloadManager.Query().setFilterById(id)).use { c ->
        if (c.moveToFirst()) {
          val state = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
          val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
          val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
          val reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
          when (state) {
            DownloadManager.STATUS_SUCCESSFUL -> prefs().edit().remove("dl_$file").apply()
            DownloadManager.STATUS_FAILED -> {
              prefs().edit().remove("dl_$file").apply()
              call.resolve(result.put("state", "failed").put("reason", reason))
              return
            }
            else -> {
              val paused = state == DownloadManager.STATUS_PAUSED || state == DownloadManager.STATUS_PENDING
              call.resolve(
                result
                  .put("state", if (paused) "waiting" else "downloading")
                  .put("reason", reason)
                  .put("bytes", done.toDouble())
                  .put("total", (if (total > 0) total else size).toDouble())
              )
              return
            }
          }
        } else {
          prefs().edit().remove("dl_$file").apply()
        }
      }
    }
    val complete = target.exists() && (size <= 0 || target.length() == size)
    call.resolve(result.put("state", if (complete) "ready" else "absent").put("bytes", target.length().toDouble()))
  }

  @PluginMethod
  fun download(call: PluginCall) {
    val file = call.getString("file") ?: return call.reject("file is required")
    val url = call.getString("url") ?: return call.reject("url is required")
    val title = call.getString("title") ?: "Dillo"
    val target = File(modelsDir(), file)
    if (target.exists()) target.delete()
    val request =
      DownloadManager.Request(Uri.parse(url))
        .setTitle(title)
        .setDescription("Dillo")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setAllowedOverMetered(call.getBoolean("allowMobileData", false) == true)
        .setDestinationUri(Uri.fromFile(target))
    val id = downloads().enqueue(request)
    prefs().edit().putLong("dl_$file", id).apply()
    call.resolve()
  }

  @PluginMethod
  fun cancelDownload(call: PluginCall) {
    val file = call.getString("file") ?: return call.reject("file is required")
    val id = prefs().getLong("dl_$file", -1L)
    if (id >= 0) downloads().remove(id)
    prefs().edit().remove("dl_$file").apply()
    File(modelsDir(), file).delete()
    call.resolve()
  }

  @PluginMethod
  fun remove(call: PluginCall) {
    val file = call.getString("file") ?: return call.reject("file is required")
    worker.execute {
      if (loadedFile == file) unloadEngine()
      File(modelsDir(), file).delete()
      call.resolve()
    }
  }

  /** Loads the model into memory (takes several seconds). GPU first, CPU if the GPU path fails. */
  @PluginMethod
  fun load(call: PluginCall) {
    val file = call.getString("file") ?: return call.reject("file is required")
    worker.execute {
      if (loadedFile == file && engine != null) {
        call.resolve(JSObject().put("backend", loadedBackend))
        return@execute
      }
      unloadEngine()
      val path = File(modelsDir(), file).absolutePath
      val attempts = if (call.getBoolean("cpuOnly", false) == true) listOf("CPU") else listOf("GPU", "CPU")
      var lastError: Exception? = null
      for (name in attempts) {
        try {
          val config =
            EngineConfig(
              modelPath = path,
              backend = if (name == "GPU") Backend.GPU() else Backend.CPU(),
              maxNumTokens = 4096,
              cacheDir = context.cacheDir.path,
            )
          val created = Engine(config)
          created.initialize()
          engine = created
          loadedFile = file
          loadedBackend = name
          call.resolve(JSObject().put("backend", name))
          return@execute
        } catch (e: Exception) {
          Log.w(TAG, "Loading on $name failed", e)
          lastError = e
        }
      }
      call.reject("load_failed: ${lastError?.message}")
    }
  }

  @PluginMethod
  fun unload(call: PluginCall) {
    worker.execute {
      unloadEngine()
      call.resolve()
    }
  }

  /**
   * One stateless generation: a fresh conversation with the given system instruction.
   * Streams "token" events and resolves with the full text. With `schema`, output is constrained
   * to that JSON schema (falls back to free text if constrained decoding is unavailable).
   */
  @PluginMethod
  fun generate(call: PluginCall) {
    val current = engine ?: return call.reject("not_loaded")
    val prompt = call.getString("prompt") ?: return call.reject("prompt is required")
    if (!busy.compareAndSet(false, true)) return call.reject("busy")
    val system = call.getString("system") ?: ""
    val schema = call.getString("schema")
    val requestId = call.getString("id") ?: ""
    val temperature = call.getDouble("temperature") ?: 0.4
    val maxTokens = call.getInt("maxTokens") ?: 1200

    worker.execute {
      val conversation =
        try {
          openConversation(current, system, temperature, schema != null)
        } catch (e: Exception) {
          Log.w(TAG, "Constrained conversation unavailable, using free text", e)
          try {
            openConversation(current, system, temperature, false)
          } catch (e2: Exception) {
            busy.set(false)
            call.reject("generate_failed: ${e2.message}")
            return@execute
          }
        }
      active = conversation
      val text = StringBuilder()
      val format =
        if (schema != null && conversation.enableResponseFormat) {
          try {
            ResponseFormat.json(schema)
          } catch (e: Exception) {
            null
          }
        } else null

      val callback =
        object : MessageCallback {
          override fun onMessage(message: Message) {
            val chunk = message.toString()
            if (chunk.isEmpty()) return
            text.append(chunk)
            notifyListeners("token", JSObject().put("id", requestId).put("text", chunk))
          }

          override fun onDone() {
            finish(conversation)
            call.resolve(JSObject().put("text", text.toString()))
          }

          override fun onError(throwable: Throwable) {
            finish(conversation)
            if (text.isNotEmpty()) call.resolve(JSObject().put("text", text.toString()).put("partial", true))
            else call.reject("generate_failed: ${throwable.message}")
          }
        }

      try {
        conversation.sendMessageAsync(
          Contents.of(Content.Text(prompt)),
          callback,
          extraContext = mapOf("enable_thinking" to false),
          maxOutputToken = maxTokens,
          thinkingConfig = ThinkingConfig(enableThinking = false),
          responseFormat = format,
        )
      } catch (e: Exception) {
        finish(conversation)
        call.reject("generate_failed: ${e.message}")
      }
    }
  }

  @PluginMethod
  fun cancel(call: PluginCall) {
    try {
      active?.cancelProcess()
    } catch (e: Exception) {
      Log.w(TAG, "cancel failed", e)
    }
    call.resolve()
  }

  private fun openConversation(engine: Engine, system: String, temperature: Double, constrained: Boolean): Conversation =
    engine.createConversation(
      ConversationConfig(
        systemInstruction = if (system.isNotEmpty()) Contents.of(Content.Text(system)) else null,
        samplerConfig = SamplerConfig(topK = 40, topP = 0.9, temperature = temperature),
        enableResponseFormat = constrained,
      )
    )

  private fun finish(conversation: Conversation) {
    if (active === conversation) active = null
    try {
      conversation.close()
    } catch (e: Exception) {
      Log.w(TAG, "close failed", e)
    }
    busy.set(false)
  }

  private fun unloadEngine() {
    try {
      active?.cancelProcess()
    } catch (_: Exception) {}
    try {
      engine?.close()
    } catch (e: Exception) {
      Log.w(TAG, "engine close failed", e)
    }
    engine = null
    loadedFile = null
    loadedBackend = null
  }

  override fun handleOnDestroy() {
    worker.execute { unloadEngine() }
    super.handleOnDestroy()
  }

  companion object {
    private const val TAG = "LocalBrain"
  }
}
