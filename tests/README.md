# Pruebas

- `supabase_rls.mjs`: permisos (RLS / funciones) contra el proyecto real. Requiere usuarios de prueba `mt-test-{cli,cli2,rep,due,dir}@mandados-test.dev` (contraseña de prueba) y roles dueño/directivo asignados por SQL. Correr: `npm i @supabase/supabase-js@2.118.0 ws && node supabase_rls.mjs`.
- `supabase_e2e.py`: flujo completo con Playwright (cliente → tienda → repartidor → dueño/directivo, tiempo real y chat). Servir la carpeta en `http://localhost:8000/`.
- `supabase_guest.py`: pedido como invitado (sesión anónima).
- `test_v12.py`: pruebas antiguas de la versión solo-local (v12); ya no aplican desde que los datos viven en Supabase.

Después de probar se borran los usuarios y datos de prueba (el catálogo de ejemplo se conserva).
