// app.js - UI, flujo de pre-permiso y consumo de geo-helper.js

const SUCURSALES = [
  { nombre: 'Ciudad de México', lat: 19.4326, lon: -99.1332 },
  { nombre: 'Guadalajara', lat: 20.6597, lon: -103.3496 },
  { nombre: 'Monterrey', lat: 25.6866, lon: -100.3161 },
  { nombre: 'Puebla', lat: 19.0414, lon: -98.2063 },
  { nombre: 'Mérida', lat: 20.9674, lon: -89.5926 },
  { nombre: 'Tijuana', lat: 32.5149, lon: -117.0382 }
];

function $(id) {
  return document.getElementById(id);
}

function mostrar(id) { $(id).hidden = false; }
function ocultar(id) { $(id).hidden = true; }

function mostrarCargando(texto) {
  const estado = $('estado');
  estado.className = 'estado cargando';
  estado.textContent = texto;
  estado.hidden = false;
}

function mostrarMensajeError(texto) {
  const estado = $('estado');
  estado.className = 'estado error';
  estado.textContent = texto;
  estado.hidden = false;
}

function limpiarEstado() {
  $('estado').hidden = true;
}

function opcionesActuales() {
  return {
    enableHighAccuracy: $('altaPrecision').checked,
    timeout: 8000,
    maximumAge: 0
  };
}

// ---- Plan B: selector manual de zona ----
function habilitarSelectorManualZona(mensajeExtra) {
  ocultar('tarjetaPrePermiso');
  $('ayudaDenegado').hidden = !mensajeExtra;
  $('ayudaDenegado').textContent = mensajeExtra || '';
  mostrar('tarjetaManual');
}

function llenarSelectorZonas() {
  const select = $('selectZona');
  SUCURSALES.forEach((s, i) => {
    const op = document.createElement('option');
    op.value = String(i);
    op.textContent = s.nombre;
    select.appendChild(op);
  });
}

function confirmarZonaManual() {
  const zona = SUCURSALES[Number($('selectZona').value)];
  ocultar('resultado');
  limpiarEstado();
  const caja = $('zonaManual');
  caja.textContent = 'Zona seleccionada manualmente: ' + zona.nombre;
  caja.hidden = false;
}

// ---- Resultado y calidad de señal ----
function renderizarResultadoUbicacion(ubicacion) {
  const calidad = clasificarPrecision(ubicacion.precisionMetros);
  $('zonaManual').hidden = true;
  $('valLat').textContent = ubicacion.latitud.toFixed(6);
  $('valLon').textContent = ubicacion.longitud.toFixed(6);
  $('valPrecision').textContent = ubicacion.precisionMetros + ' m';
  $('valHora').textContent = new Date(ubicacion.timestamp).toLocaleTimeString();

  const badge = $('badgeCalidad');
  badge.textContent = calidad.etiqueta;
  badge.className = 'badge ' + calidad.nivel;

  mostrar('resultado');
  ocultar('tarjetaManual');
  limpiarEstado();
}

// ---- Lectura real (siempre llamada desde un click directo cuando hay diálogo) ----
function leerUbicacion() {
  ocultar('tarjetaPrePermiso');
  mostrarCargando('Obteniendo coordenadas...');

  return obtenerUbicacionActual(opcionesActuales())
    .then((ubicacion) => {
      renderizarResultadoUbicacion(ubicacion);
      return ubicacion;
    })
    .catch((error) => {
      console.warn('[Geo] Fallback activado:', error.message);
      mostrarMensajeError(error.message);
      if (error.codigo === 1) {
        habilitarSelectorManualZona(textoReactivarPermiso());
      } else {
        habilitarSelectorManualZona(
          error.codigo === 3
            ? 'Tip: en equipos sin GPS desactiva "Alta precisión" e intenta de nuevo.'
            : ''
        );
      }
    });
}

function textoReactivarPermiso() {
  return 'Para reactivar: toca el ícono de candado/ajustes junto a la URL > Permisos > Ubicación > Permitir. ' +
    'En iPhone: Ajustes > Privacidad > Localización > Safari (o la PWA instalada, que tiene permisos aparte).';
}

// ---- Flujo de pre-permiso ----
function alPulsarAdjuntar() {
  limpiarEstado();
  ocultar('resultado');
  ocultar('tarjetaManual');
  $('zonaManual').hidden = true;

  consultarEstadoPermisoGeo().then((estado) => {
    console.log('[Geo] Estado del permiso:', estado);
    if (estado === 'granted') {
      leerUbicacion();
    } else if (estado === 'denied') {
      habilitarSelectorManualZona(textoReactivarPermiso());
    } else {
      mostrar('tarjetaPrePermiso'); // el diálogo nativo solo sale tras confirmar aquí
    }
  });
}

// ---- Segundo consumidor del helper: sucursal más cercana (baja precisión) ----
function buscarSucursalesCercanas() {
  mostrarCargando('Buscando sucursal cercana...');
  return obtenerUbicacionActual({ enableHighAccuracy: false, maximumAge: 60000 })
    .then((ubicacion) => {
      let mejor = null;
      SUCURSALES.forEach((s) => {
        const d = distanciaKm(ubicacion.latitud, ubicacion.longitud, s.lat, s.lon);
        if (!mejor || d < mejor.km) { mejor = { nombre: s.nombre, km: d }; }
      });
      limpiarEstado();
      const caja = $('zonaManual');
      caja.textContent = 'Sucursal más cercana: ' + mejor.nombre + ' (' + Math.round(mejor.km) + ' km)';
      caja.hidden = false;
    })
    .catch((error) => {
      mostrarMensajeError(error.message);
      habilitarSelectorManualZona();
    });
}

function alPulsarSucursal() {
  consultarEstadoPermisoGeo().then((estado) => {
    if (estado === 'denied') {
      habilitarSelectorManualZona(textoReactivarPermiso());
    } else if (estado === 'prompt') {
      mostrar('tarjetaPrePermiso');
    } else {
      buscarSucursalesCercanas();
    }
  });
}

// ---- Inicio ----
function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[SW] Registrado, scope:', reg.scope))
      .catch((err) => console.warn('[SW] Error de registro:', err));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  llenarSelectorZonas();
  $('btnAdjuntar').addEventListener('click', alPulsarAdjuntar);
  $('btnSucursal').addEventListener('click', alPulsarSucursal);
  $('btnConfirmar').addEventListener('click', leerUbicacion); // click directo: válido para iOS
  $('btnCancelar').addEventListener('click', () => {
    ocultar('tarjetaPrePermiso');
    habilitarSelectorManualZona();
  });
  $('btnZona').addEventListener('click', confirmarZonaManual);
  registrarServiceWorker();
});
