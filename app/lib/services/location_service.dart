import 'package:geolocator/geolocator.dart';

class LocationService {
  const LocationService();

  Future<Map<String, dynamic>> getCurrentLocationPayload() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return _unavailable('GPS_DESLIGADO');
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return _unavailable('PERMISSAO_NEGADA');
      }

      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) {
        return {
          'gps_disponivel': true,
          'latitude': lastKnown.latitude,
          'longitude': lastKnown.longitude,
          'precisao_metros': lastKnown.accuracy,
          'gps_capturado_em': DateTime.now().toIso8601String(),
        };
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 3),
        ),
      );

      return {
        'gps_disponivel': true,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'precisao_metros': position.accuracy,
        'gps_capturado_em': DateTime.now().toIso8601String(),
      };
    } catch (error) {
      return _unavailable(error.toString());
    }
  }

  Map<String, dynamic> _unavailable(String reason) {
    return {
      'gps_disponivel': false,
      'gps_motivo': reason,
      'gps_capturado_em': DateTime.now().toIso8601String(),
    };
  }
}
