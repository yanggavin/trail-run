package expo.modules.locationtracker

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.*
import java.util.*
import kotlin.collections.ArrayList

class ExpoLocationTrackerModule : Module() {
  private var fusedLocationClient: FusedLocationProviderClient? = null
  private var locationCallback: LocationCallback? = null
  private var isTracking = false
  private var isPaused = false
  private var startTime: Long? = null
  private var lastLocation: Location? = null
  private var currentConfig: LocationConfig? = null
  
  // Location filtering and smoothing
  private val locationBuffer = ArrayList<Location>()
  private val bufferSize = 5
  private var lastValidLocation: Location? = null
  
  // Foreground service
  private var foregroundServiceIntent: Intent? = null
  
  override fun definition() = ModuleDefinition {
    Name("ExpoLocationTracker")
    
    Events("onLocationUpdate", "onTrackingStatusChange", "onPermissionStatusChange")
    
    AsyncFunction("startLocationUpdates") { config: LocationConfig ->
      startLocationUpdates(config)
    }
    
    AsyncFunction("stopLocationUpdates") {
      stopLocationUpdates()
    }
    
    AsyncFunction("pauseLocationUpdates") {
      pauseLocationUpdates()
    }
    
    AsyncFunction("resumeLocationUpdates") {
      resumeLocationUpdates()
    }
    
    AsyncFunction("getCurrentLocation") {
      getCurrentLocation()
    }
    
    AsyncFunction("requestPermissions") {
      requestPermissions()
    }
    
    AsyncFunction("getTrackingStatus") {
      getTrackingStatus()
    }
  }
  
  // MARK: - Public Methods
  
  private suspend fun startLocationUpdates(config: LocationConfig) = withContext(Dispatchers.Main) {
    currentConfig = config
    
    if (!hasLocationPermissions()) {
      throw Exception("Location permissions not granted")
    }
    
    setupLocationClient()
    
    val locationRequest = createLocationRequest(config)
    
    locationCallback = object : LocationCallback() {
      override fun onLocationResult(locationResult: LocationResult) {
        super.onLocationResult(locationResult)
        handleLocationUpdate(locationResult.lastLocation)
      }
      
      override fun onLocationAvailability(locationAvailability: LocationAvailability) {
        super.onLocationAvailability(locationAvailability)
        if (!locationAvailability.isLocationAvailable) {
          // Handle GPS signal loss
          sendEvent("onLocationUpdate", mapOf(
            "latitude" to 0.0,
            "longitude" to 0.0,
            "accuracy" to -1.0,
            "timestamp" to System.currentTimeMillis(),
            "source" to "unavailable"
          ))
        }
      }
    }
    
    try {
      fusedLocationClient?.requestLocationUpdates(
        locationRequest,
        locationCallback!!,
        Looper.getMainLooper()
      )
      
      // Start foreground service for background tracking
      if (config.backgroundTracking) {
        startForegroundService()
      }
      
      isTracking = true
      isPaused = false
      startTime = System.currentTimeMillis()
      
      sendTrackingStatusUpdate()
      
    } catch (securityException: SecurityException) {
      throw Exception("Location permission denied: ${securityException.message}")
    }
  }
  
  private suspend fun stopLocationUpdates() = withContext(Dispatchers.Main) {
    locationCallback?.let { callback ->
      fusedLocationClient?.removeLocationUpdates(callback)
    }
    
    stopForegroundService()
    
    isTracking = false
    isPaused = false
    startTime = null
    lastLocation = null
    locationBuffer.clear()
    
    sendTrackingStatusUpdate()
  }
  
  private suspend fun pauseLocationUpdates() = withContext(Dispatchers.Main) {
    isPaused = true
    sendTrackingStatusUpdate()
  }
  
  private suspend fun resumeLocationUpdates() = withContext(Dispatchers.Main) {
    isPaused = false
    sendTrackingStatusUpdate()
  }
  
  private suspend fun getCurrentLocation(): Map<String, Any?> = withContext(Dispatchers.Main) {
    if (!hasLocationPermissions()) {
      throw Exception("Location permissions not granted")
    }
    
    setupLocationClient()
    
    return@withContext suspendCancellableCoroutine { continuation ->
      try {
        fusedLocationClient?.lastLocation?.addOnSuccessListener { location ->
          if (location != null) {
            val locationMap = createLocationMap(location)
            continuation.resume(locationMap) {}
          } else {
            // Request a fresh location
            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
              .setMaxUpdates(1)
              .build()
            
            val callback = object : LocationCallback() {
              override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)
                val freshLocation = locationResult.lastLocation
                if (freshLocation != null) {
                  val locationMap = createLocationMap(freshLocation)
                  continuation.resume(locationMap) {}
                } else {
                  continuation.resume(mapOf(
                    "latitude" to 0.0,
                    "longitude" to 0.0,
                    "accuracy" to -1.0,
                    "timestamp" to System.currentTimeMillis(),
                    "source" to "error"
                  )) {}
                }
                fusedLocationClient?.removeLocationUpdates(this)
              }
            }
            
            fusedLocationClient?.requestLocationUpdates(
              locationRequest,
              callback,
              Looper.getMainLooper()
            )
          }
        }?.addOnFailureListener { exception ->
          continuation.resume(mapOf(
            "latitude" to 0.0,
            "longitude" to 0.0,
            "accuracy" to -1.0,
            "timestamp" to System.currentTimeMillis(),
            "source" to "error"
          )) {}
        }
      } catch (securityException: SecurityException) {
        continuation.resume(mapOf(
          "latitude" to 0.0,
          "longitude" to 0.0,
          "accuracy" to -1.0,
          "timestamp" to System.currentTimeMillis(),
          "source" to "error"
        )) {}
      }
    }
  }
  
  private suspend fun requestPermissions(): Map<String, Any> = withContext(Dispatchers.Main) {
    val context = appContext.reactContext ?: throw Exception("React context not available")
    
    val fineLocationGranted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    
    val coarseLocationGranted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    
    val backgroundLocationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true // Not required for older versions
    }
    
    val granted = fineLocationGranted && coarseLocationGranted && backgroundLocationGranted
    
    return@withContext mapOf(
      "granted" to granted,
      "canAskAgain" to true, // Android allows asking again
      "status" to if (granted) "granted" else "denied"
    )
  }
  
  private fun getTrackingStatus(): Map<String, Any?> {
    val status = mutableMapOf<String, Any?>(
      "isTracking" to isTracking,
      "isPaused" to isPaused
    )
    
    startTime?.let { time ->
      status["startTime"] = time
    }
    
    lastLocation?.let { location ->
      status["lastLocation"] = createLocationMap(location)
    }
    
    return status
  }
  
  // MARK: - Private Methods
  
  private fun setupLocationClient() {
    if (fusedLocationClient == null) {
      val context = appContext.reactContext ?: throw Exception("React context not available")
      fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    }
  }
  
  private fun createLocationRequest(config: LocationConfig): LocationRequest {
    val priority = when (config.accuracy) {
      "high" -> Priority.PRIORITY_HIGH_ACCURACY
      "balanced" -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
      "low" -> Priority.PRIORITY_LOW_POWER
      else -> Priority.PRIORITY_HIGH_ACCURACY
    }
    
    return LocationRequest.Builder(priority, config.interval.toLong())
      .setMinUpdateDistanceMeters(config.distanceFilter.toFloat())
      .setWaitForAccurateLocation(true)
      .build()
  }
  
  private fun hasLocationPermissions(): Boolean {
    val context = appContext.reactContext ?: return false
    
    val fineLocationGranted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    
    val coarseLocationGranted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    
    return fineLocationGranted && coarseLocationGranted
  }
  
  private fun createLocationMap(location: Location): Map<String, Any?> {
    return mapOf(
      "latitude" to location.latitude,
      "longitude" to location.longitude,
      "altitude" to if (location.hasAltitude()) location.altitude else null,
      "accuracy" to location.accuracy.toDouble(),
      "speed" to if (location.hasSpeed()) location.speed.toDouble() else null,
      "heading" to if (location.hasBearing()) location.bearing.toDouble() else null,
      "timestamp" to location.time,
      "source" to "gps"
    )
  }
  
  private fun isLocationValid(location: Location?): Boolean {
    if (location == null) return false
    
    // Filter out locations with poor accuracy
    if (location.accuracy > 100 || location.accuracy <= 0) {
      return false
    }
    
    // Filter out locations that are too old
    val locationAge = System.currentTimeMillis() - location.time
    if (locationAge > 30000) { // 30 seconds
      return false
    }
    
    // Filter out impossible speeds (> 50 m/s = 180 km/h)
    lastValidLocation?.let { lastLocation ->
      val distance = location.distanceTo(lastLocation)
      val timeInterval = (location.time - lastLocation.time) / 1000.0 // seconds
      
      if (timeInterval > 0) {
        val speed = distance / timeInterval
        if (speed > 50) {
          return false
        }
      }
    }
    
    return true
  }
  
  private fun smoothLocation(location: Location): Location? {
    locationBuffer.add(location)
    
    if (locationBuffer.size > bufferSize) {
      locationBuffer.removeAt(0)
    }
    
    // Need at least 3 points for smoothing
    if (locationBuffer.size < 3) {
      return location
    }
    
    // Simple moving average for smoothing
    val avgLat = locationBuffer.map { it.latitude }.average()
    val avgLon = locationBuffer.map { it.longitude }.average()
    val avgAlt = locationBuffer.filter { it.hasAltitude() }.map { it.altitude }.average()
    
    val smoothedLocation = Location(location.provider)
    smoothedLocation.latitude = avgLat
    smoothedLocation.longitude = avgLon
    if (!avgAlt.isNaN()) {
      smoothedLocation.altitude = avgAlt
    }
    smoothedLocation.accuracy = location.accuracy
    smoothedLocation.time = location.time
    if (location.hasSpeed()) {
      smoothedLocation.speed = location.speed
    }
    if (location.hasBearing()) {
      smoothedLocation.bearing = location.bearing
    }
    
    return smoothedLocation
  }
  
  private fun handleLocationUpdate(location: Location?) {
    // Only process if tracking and not paused
    if (!isTracking || isPaused) return
    
    // Validate location
    if (!isLocationValid(location)) return
    
    // Apply smoothing if enabled
    val processedLocation = if (currentConfig?.adaptiveThrottling == true) {
      smoothLocation(location!!) ?: location
    } else {
      location!!
    }
    
    lastLocation = processedLocation
    lastValidLocation = processedLocation
    
    val locationMap = createLocationMap(processedLocation)
    sendEvent("onLocationUpdate", locationMap)
  }
  
  private fun startForegroundService() {
    val context = appContext.reactContext ?: return
    
    // Create notification channel for Android O and above
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        NOTIFICATION_CHANNEL_ID,
        "GPS Tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Ongoing GPS tracking for trail running"
        setShowBadge(false)
      }
      
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
    
    foregroundServiceIntent = Intent(context, LocationTrackingService::class.java)
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(foregroundServiceIntent)
    } else {
      context.startService(foregroundServiceIntent)
    }
  }
  
  private fun stopForegroundService() {
    val context = appContext.reactContext ?: return
    foregroundServiceIntent?.let { intent ->
      context.stopService(intent)
    }
    foregroundServiceIntent = null
  }
  
  private fun sendTrackingStatusUpdate() {
    sendEvent("onTrackingStatusChange", getTrackingStatus())
  }
  
  companion object {
    private const val NOTIFICATION_CHANNEL_ID = "location_tracking_channel"
    private const val NOTIFICATION_ID = 1001
  }
}

// MARK: - Supporting Types

data class LocationConfig(
  @Field val accuracy: String = "high",
  @Field val interval: Int = 1000,
  @Field val distanceFilter: Double = 0.0,
  @Field val adaptiveThrottling: Boolean = true,
  @Field val backgroundTracking: Boolean = true
) : Record

// MARK: - Foreground Service

class LocationTrackingService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null
  
  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }
  
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, createNotification())
    return START_STICKY
  }
  
  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        NOTIFICATION_CHANNEL_ID,
        "GPS Tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Ongoing GPS tracking for trail running"
        setShowBadge(false)
      }
      
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }
  
  private fun createNotification(): Notification {
    val intent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    
    return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
      .setContentTitle("TrailRun GPS Tracking")
      .setContentText("Recording your trail run...")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }
  
  companion object {
    private const val NOTIFICATION_CHANNEL_ID = "location_tracking_channel"
    private const val NOTIFICATION_ID = 1001
  }
}