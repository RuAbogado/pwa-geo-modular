// geo-helper.js - Módulo reutilizable de geolocalización (Vanilla JS, solo Promesas)

function traducirErrorGeolocalizacion(error) {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'Permiso de ubicación denegado. Puedes ingresar tu zona manualmente.';
    case 2: // POSITION_UNAVAILABLE
      return 'No fue posible determinar tu ubicación (señal GPS o Wi-Fi no disponible).';
    case 3: // TIMEOUT
      return 'Se agotó el tiempo de espera intentando obtener las coordenadas.';
    default:
      return 'Ocurrió un error inesperado al consultar la ubicación.';
  }
}

// Devuelve una Promesa que resuelve con un objeto normalizado:
// { latitud, longitud, precisionMetros, timestamp }
// Rechaza con Error (message en español) y error.codigo = 0 (sin soporte), 1, 2 o 3.
function obtenerUbicacionActual(opcionesPersonalizadas) {
  const opciones = Object.assign(
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000 // acepta una lectura de hasta 30 s
    },
    opcionesPersonalizadas
  );

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      const sinSoporte = new Error('Este navegador no soporta la API de Geolocalización.');
      sinSoporte.codigo = 0;
      reject(sinSoporte);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolve({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precisionMetros: Math.round(posicion.coords.accuracy),
          timestamp: posicion.timestamp
        });
      },
      (error) => {
        const err = new Error(traducirErrorGeolocalizacion(error));
        err.codigo = error.code;
        reject(err);
      },
      opciones
    );
  });
}

// Resuelve siempre con 'granted' | 'denied' | 'prompt' (nunca rechaza).
function consultarEstadoPermisoGeo() {
  if (!('permissions' in navigator) || !navigator.permissions.query) {
    return Promise.resolve('prompt');
  }

  return navigator.permissions.query({ name: 'geolocation' })
    .then((resultado) => resultado.state)
    .catch(() => 'prompt');
}

// Clasifica la precisión (coords.accuracy, en metros).
function clasificarPrecision(metros) {
  if (metros < 30) {
    return { nivel: 'alta', etiqueta: 'Precisión GPS Alta' };
  }
  return { nivel: 'aproximada', etiqueta: 'Ubicación Aproximada (Wi-Fi / IP)' };
}

// Distancia en km entre dos puntos (fórmula de Haversine).
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
