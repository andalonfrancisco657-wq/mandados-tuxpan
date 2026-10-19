# Pruebas

- `supabase_rls.mjs`: permisos (RLS / funciones) contra el proyecto real. Requiere usuarios de prueba `mt-test-{cli,cli2,rep,due,dir}@mandados-test.dev` (contraseña de prueba) y roles dueño/directivo asignados por SQL. Correr: `npm i @supabase/supabase-js@2.118.0 ws && node supabase_rls.mjs`.
- `supabase_e2e.py`: flujo completo con Playwright (cliente → tienda → repartidor → dueño/directivo, tiempo real y chat). Servir la carpeta en `http://localhost:8000/`.
- `supabase_guest.py`: pedido como invitado (sesión anónima).
- `test_v12.py`: pruebas antiguas de la versión solo-local (v12); ya no aplican desde que los datos viven en Supabase.

Después de probar se borran los usuarios y datos de prueba (el catálogo de ejemplo se conserva).

## Mapa de repartidores (v22)
- `map_rls.mjs` (node, en /workspace/t): RLS de ubicaciones/alertas; crea un pedido de prueba e imprime ORDER=.
- `map_drivers.py` (Playwright, geolocalización simulada): `MT_TEST_STORE=<id> MT_TEST_ORDER=<id> python3 tests/map_drivers.py`.

## Importar productos (v23)
- `product_import.py`: `MT_TEST_STORE=<id> python3 tests/product_import.py` (tienda de prueba con "Producto mapa (test)"). Solo aprueba solicitudes de esa tienda.
Limpieza: borrar solo por IDs exactos lo creado en la corrida.

## Comprobantes por paso (v24)
- `step_proofs.mjs` (node, /workspace/t): intenta saltar pasos, códigos incorrectos, otro repartidor, bloqueo a los 5 intentos, foto falsa.
- `step_proofs_ui.py` (+ `step_helper.mjs` copiado a /workspace/t): recogido, código de entrega, entrega con foto, vista del dueño.
Ojo: límite de 5 pedidos/10 min por cliente y 15 códigos incorrectos/hora por repartidor.
`supabase_e2e.py` usa el flujo anterior del repartidor (botón “Pasar a…”) y ya no aplica a recogido/entregado.

## Pin del domicilio (v25)
- `client_pin.mjs` (node): visibilidad del pin (cliente/asignado/dueño sí; tienda/otros repartidores no), distancia en entrega con código y con foto (rechazo >150 m o sin GPS).
- `client_pin_ui.py`: el cliente marca su casa, el repartidor ve el mapa, el dueño ve la distancia.
