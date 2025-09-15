import ExpoModulesCore
import CoreLocation
import UIKit

public class ExpoLocationTrackerModule: Module, CLLocationManagerDelegate {
  private var locationManager: CLLocationManager?
  private var isTracking = false
  private var isPaused = false
  private var startTime: Date?
  private var lastLocation: CLLocation?
  private var currentConfig: LocationConfig?
  
  // Location filtering and smoothing
  private var locationBuffer: [CLLocation] = []
  private let bufferSize = 5
  private var lastValidLocation: CLLocation?
  
  // Background task management
  private var backgroundTaskIdentifier: UIBackgroundTaskIdentifier = .invalid
  
  public func definition() -> ModuleDefinition {
    Name("ExpoLocationTracker")
    
    Events("onLocationUpdate", "onTrackingStatusChange", "onPermissionStatusChange")
    
    AsyncFunction("startLocationUpdates") { (config: LocationConfig) in
      try await self.startLocationUpdates(config: config)
    }
    
    AsyncFunction("stopLocationUpdates") {
      try await self.stopLocationUpdates()
    }
    
    AsyncFunction("pauseLocationUpdates") {
      try await self.pauseLocationUpdates()
    }
    
    AsyncFunction("resumeLocationUpdates") {
      try await self.resumeLocationUpdates()
    }
    
    AsyncFunction("getCurrentLocation") { () -> [String: Any] in
      return try await self.getCurrentLocation()
    }
    
    AsyncFunction("requestPermissions") { () -> [String: Any] in
      return try await self.requestPermissions()
    }
    
    AsyncFunction("getTrackingStatus") { () -> [String: Any] in
      return self.getTrackingStatus()
    }
    
    OnAppEntersBackground {
      self.handleAppEntersBackground()
    }
    
    OnAppEntersForeground {
      self.handleAppEntersForeground()
    }
  }
  
  // MARK: - Public Methods
  
  private func startLocationUpdates(config: LocationConfig) async throws {
    self.currentConfig = config
    
    await MainActor.run {
      self.setupLocationManager()
      self.configureLocationManager(config: config)
      
      self.isTracking = true
      self.isPaused = false
      self.startTime = Date()
      
      self.locationManager?.startUpdatingLocation()
      
      // Enable background location if needed
      if config.backgroundTracking {
        self.locationManager?.allowsBackgroundLocationUpdates = true
        self.locationManager?.pausesLocationUpdatesAutomatically = false
      }
      
      self.sendTrackingStatusUpdate()
    }
  }
  
  private func stopLocationUpdates() async throws {
    await MainActor.run {
      self.locationManager?.stopUpdatingLocation()
      self.locationManager?.stopMonitoringSignificantLocationChanges()
      self.locationManager?.allowsBackgroundLocationUpdates = false
      
      self.endBackgroundTask()
      
      self.isTracking = false
      self.isPaused = false
      self.startTime = nil
      self.lastLocation = nil
      self.locationBuffer.removeAll()
      
      self.sendTrackingStatusUpdate()
    }
  }
  
  private func pauseLocationUpdates() async throws {
    await MainActor.run {
      self.isPaused = true
      self.sendTrackingStatusUpdate()
    }
  }
  
  private func resumeLocationUpdates() async throws {
    await MainActor.run {
      self.isPaused = false
      self.sendTrackingStatusUpdate()
    }
  }
  
  private func getCurrentLocation() async throws -> [String: Any] {
    return await withCheckedContinuation { continuation in
      DispatchQueue.main.async {
        self.setupLocationManager()
        
        self.locationManager?.requestLocation()
        
        // Store continuation for one-time location request
        self.oneTimeLocationContinuation = continuation
      }
    }
  }
  
  private var oneTimeLocationContinuation: CheckedContinuation<[String: Any], Never>?
  
  private func requestPermissions() async throws -> [String: Any] {
    return await withCheckedContinuation { continuation in
      DispatchQueue.main.async {
        self.setupLocationManager()
        
        let currentStatus = self.locationManager?.authorizationStatus ?? .notDetermined
        
        if currentStatus == .notDetermined {
          self.permissionContinuation = continuation
          self.locationManager?.requestAlwaysAuthorization()
        } else {
          let permissionStatus = self.createPermissionStatus(from: currentStatus)
          continuation.resume(returning: permissionStatus)
        }
      }
    }
  }
  
  private var permissionContinuation: CheckedContinuation<[String: Any], Never>?
  
  private func getTrackingStatus() -> [String: Any] {
    var status: [String: Any] = [
      "isTracking": isTracking,
      "isPaused": isPaused
    ]
    
    if let startTime = startTime {
      status["startTime"] = startTime.timeIntervalSince1970 * 1000
    }
    
    if let lastLocation = lastLocation {
      status["lastLocation"] = createLocationDict(from: lastLocation)
    }
    
    return status
  }
  
  // MARK: - Private Methods
  
  private func setupLocationManager() {
    if locationManager == nil {
      locationManager = CLLocationManager()
      locationManager?.delegate = self
    }
  }
  
  private func configureLocationManager(config: LocationConfig) {
    guard let manager = locationManager else { return }
    
    // Set accuracy based on config
    switch config.accuracy {
    case "high":
      manager.desiredAccuracy = kCLLocationAccuracyBest
    case "balanced":
      manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    case "low":
      manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    default:
      manager.desiredAccuracy = kCLLocationAccuracyBest
    }
    
    // Set distance filter
    manager.distanceFilter = config.distanceFilter
    
    // Configure for background usage
    if config.backgroundTracking {
      manager.allowsBackgroundLocationUpdates = true
      manager.pausesLocationUpdatesAutomatically = false
    }
  }
  
  private func createLocationDict(from location: CLLocation) -> [String: Any] {
    return [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "altitude": location.altitude,
      "accuracy": location.horizontalAccuracy,
      "speed": location.speed >= 0 ? location.speed : nil,
      "heading": location.course >= 0 ? location.course : nil,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
      "source": "gps"
    ]
  }
  
  private func createPermissionStatus(from status: CLAuthorizationStatus) -> [String: Any] {
    let granted = status == .authorizedAlways || status == .authorizedWhenInUse
    let canAskAgain = status == .notDetermined
    
    var statusString: String
    switch status {
    case .authorizedAlways, .authorizedWhenInUse:
      statusString = "granted"
    case .denied:
      statusString = "denied"
    case .restricted:
      statusString = "restricted"
    case .notDetermined:
      statusString = "undetermined"
    @unknown default:
      statusString = "undetermined"
    }
    
    return [
      "granted": granted,
      "canAskAgain": canAskAgain,
      "status": statusString
    ]
  }
  
  private func isLocationValid(_ location: CLLocation) -> Bool {
    // Filter out locations with poor accuracy
    if location.horizontalAccuracy > 100 || location.horizontalAccuracy < 0 {
      return false
    }
    
    // Filter out locations that are too old
    if abs(location.timestamp.timeIntervalSinceNow) > 30 {
      return false
    }
    
    // Filter out impossible speeds (> 50 m/s = 180 km/h)
    if let lastLocation = lastValidLocation {
      let distance = location.distance(from: lastLocation)
      let timeInterval = location.timestamp.timeIntervalSince(lastLocation.timestamp)
      
      if timeInterval > 0 {
        let speed = distance / timeInterval
        if speed > 50 {
          return false
        }
      }
    }
    
    return true
  }
  
  private func smoothLocation(_ location: CLLocation) -> CLLocation? {
    locationBuffer.append(location)
    
    if locationBuffer.count > bufferSize {
      locationBuffer.removeFirst()
    }
    
    // Need at least 3 points for smoothing
    if locationBuffer.count < 3 {
      return location
    }
    
    // Simple moving average for smoothing
    let avgLat = locationBuffer.map { $0.coordinate.latitude }.reduce(0, +) / Double(locationBuffer.count)
    let avgLon = locationBuffer.map { $0.coordinate.longitude }.reduce(0, +) / Double(locationBuffer.count)
    let avgAlt = locationBuffer.compactMap { $0.altitude }.reduce(0, +) / Double(locationBuffer.compactMap { $0.altitude }.count)
    
    let smoothedCoordinate = CLLocationCoordinate2D(latitude: avgLat, longitude: avgLon)
    
    return CLLocation(
      coordinate: smoothedCoordinate,
      altitude: avgAlt,
      horizontalAccuracy: location.horizontalAccuracy,
      verticalAccuracy: location.verticalAccuracy,
      course: location.course,
      speed: location.speed,
      timestamp: location.timestamp
    )
  }
  
  private func sendTrackingStatusUpdate() {
    sendEvent("onTrackingStatusChange", getTrackingStatus())
  }
  
  // MARK: - Background Handling
  
  private func handleAppEntersBackground() {
    guard isTracking else { return }
    
    // Start background task to continue location updates
    startBackgroundTask()
    
    // Switch to significant location changes for better battery life
    if let locationManager = locationManager, currentConfig?.backgroundTracking == true {
      locationManager.startMonitoringSignificantLocationChanges()
    }
  }
  
  private func handleAppEntersForeground() {
    guard isTracking else { return }
    
    // End background task
    endBackgroundTask()
    
    // Resume normal location updates
    if let locationManager = locationManager {
      locationManager.stopMonitoringSignificantLocationChanges()
      locationManager.startUpdatingLocation()
    }
  }
  
  private func startBackgroundTask() {
    guard backgroundTaskIdentifier == .invalid else { return }
    
    backgroundTaskIdentifier = UIApplication.shared.beginBackgroundTask(withName: "LocationTracking") {
      // Background task is about to expire
      self.endBackgroundTask()
    }
  }
  
  private func endBackgroundTask() {
    guard backgroundTaskIdentifier != .invalid else { return }
    
    UIApplication.shared.endBackgroundTask(backgroundTaskIdentifier)
    backgroundTaskIdentifier = .invalid
  }
  
  // MARK: - CLLocationManagerDelegate
  
  public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    
    // Handle one-time location request
    if let continuation = oneTimeLocationContinuation {
      oneTimeLocationContinuation = nil
      let locationDict = createLocationDict(from: location)
      continuation.resume(returning: locationDict)
      return
    }
    
    // Only process if tracking and not paused
    guard isTracking && !isPaused else { return }
    
    // Validate location
    guard isLocationValid(location) else { return }
    
    // Apply smoothing if enabled
    let processedLocation: CLLocation
    if currentConfig?.adaptiveThrottling == true {
      processedLocation = smoothLocation(location) ?? location
    } else {
      processedLocation = location
    }
    
    lastLocation = processedLocation
    lastValidLocation = processedLocation
    
    let locationDict = createLocationDict(from: processedLocation)
    sendEvent("onLocationUpdate", locationDict)
  }
  
  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    print("Location manager failed with error: \(error.localizedDescription)")
    
    // Handle one-time location request failure
    if let continuation = oneTimeLocationContinuation {
      oneTimeLocationContinuation = nil
      let errorDict: [String: Any] = [
        "latitude": 0,
        "longitude": 0,
        "accuracy": -1,
        "timestamp": Date().timeIntervalSince1970 * 1000,
        "source": "error"
      ]
      continuation.resume(returning: errorDict)
    }
  }
  
  public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
    let permissionStatus = createPermissionStatus(from: status)
    sendEvent("onPermissionStatusChange", permissionStatus)
    
    // Handle permission request continuation
    if let continuation = permissionContinuation {
      permissionContinuation = nil
      continuation.resume(returning: permissionStatus)
    }
  }
}

// MARK: - Supporting Types

struct LocationConfig: Record {
  @Field var accuracy: String = "high"
  @Field var interval: Int = 1000
  @Field var distanceFilter: Double = 0
  @Field var adaptiveThrottling: Bool = true
  @Field var backgroundTracking: Bool = true
}