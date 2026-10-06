-- =====================================================
-- Óptica · Configuración para Supabase
-- Pegar completo en: Supabase > SQL Editor > Run
-- =====================================================

-- ---------- TABLAS ----------
create table public.clientes (
  id bigint generated always as identity primary key,
  documento text unique not null,
  nombre text not null,
  telefono text,
  correo text,
  fecha_nacimiento date,
  consentimiento_datos boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Un perfil por cada usuario de Supabase Auth (guarda el rol)
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'cliente'
    check (rol in ('administrador','optometra','vendedor','auxiliar','cliente')),
  cliente_id bigint references public.clientes(id),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.productos (
  id bigint generated always as identity primary key,
  codigo text unique not null,
  categoria text not null check (categoria in ('Montura','Lente','Accesorio','Servicio')),
  marca text,
  descripcion text not null,
  precio numeric(12,2) not null check (precio >= 0),
  stock int not null default 0 check (stock >= 0),
  stock_minimo int not null default 2,
  activo boolean not null default true
);

create table public.movimientos_inventario (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  usuario_id uuid references public.perfiles(id),
  tipo text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad int not null,
  motivo text,
  fecha timestamptz not null default now()
);

create table public.consultas (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id),
  optometra_id uuid not null references public.perfiles(id),
  fecha timestamptz not null default now(),
  motivo text,
  od_esfera numeric(4,2), od_cilindro numeric(4,2), od_eje int,
  oi_esfera numeric(4,2), oi_cilindro numeric(4,2), oi_eje int,
  adicion numeric(4,2),
  dp numeric(4,1),
  tipo_lente text,
  observaciones text
);

create table public.ventas (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id),
  vendedor_id uuid references public.perfiles(id),
  fecha timestamptz not null default now(),
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
);

create table public.detalle_ventas (
  id bigint generated always as identity primary key,
  venta_id bigint not null references public.ventas(id) on delete cascade,
  producto_id bigint not null references public.productos(id),
  descripcion text,
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null
);

create table public.pagos (
  id bigint generated always as identity primary key,
  venta_id bigint not null references public.ventas(id),
  usuario_id uuid references public.perfiles(id),
  monto numeric(12,2) not null check (monto > 0),
  forma_pago text not null check (forma_pago in ('efectivo','tarjeta','transferencia','otro')),
  fecha timestamptz not null default now()
);

-- estado: 0 Orden creada, 1 Enviada al laboratorio, 2 En producción,
-- 3 Recibida, 4 Control de calidad, 5 Lista para entrega, 6 Entregada
create table public.ordenes (
  id bigint generated always as identity primary key,
  venta_id bigint unique not null references public.ventas(id),
  estado int not null default 0 check (estado between 0 and 6),
  creado_en timestamptz not null default now(),
  fecha_entrega timestamptz
);

create table public.seguimiento_ordenes (
  id bigint generated always as identity primary key,
  orden_id bigint not null references public.ordenes(id),
  usuario_id uuid references public.perfiles(id),
  estado int not null,
  fecha timestamptz not null default now()
);

-- ---------- PERFIL AUTOMÁTICO AL CREAR UN USUARIO ----------
-- Todo usuario nuevo nace como 'cliente' (el rol de menor permiso).
create function public.nuevo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.nuevo_perfil();

-- ---------- FUNCIONES AUXILIARES DE ROL ----------
create function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create function public.mi_cliente() returns bigint
language sql stable security definer set search_path = public as $$
  select cliente_id from public.perfiles where id = auth.uid() and activo
$$;

-- ---------- SEGURIDAD POR FILA (RLS) ----------
alter table public.clientes enable row level security;
alter table public.perfiles enable row level security;
alter table public.productos enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.consultas enable row level security;
alter table public.ventas enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.pagos enable row level security;
alter table public.ordenes enable row level security;
alter table public.seguimiento_ordenes enable row level security;

-- perfiles
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = auth.uid() or public.mi_rol() = 'administrador');
create policy perfiles_editar on public.perfiles for update to authenticated
  using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

-- clientes
create policy clientes_ver on public.clientes for select to authenticated
  using (public.mi_rol() in ('administrador','optometra','vendedor','auxiliar') or id = public.mi_cliente());
create policy clientes_crear on public.clientes for insert to authenticated
  with check (public.mi_rol() in ('administrador','optometra','vendedor'));
create policy clientes_editar on public.clientes for update to authenticated
  using (public.mi_rol() in ('administrador','optometra','vendedor'))
  with check (public.mi_rol() in ('administrador','optometra','vendedor'));

-- productos (el stock solo cambia mediante las funciones de abajo)
create policy productos_ver on public.productos for select to authenticated
  using (public.mi_rol() in ('administrador','vendedor','auxiliar'));
create policy productos_crear on public.productos for insert to authenticated
  with check (public.mi_rol() = 'administrador');
create policy productos_editar on public.productos for update to authenticated
  using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

create policy movimientos_ver on public.movimientos_inventario for select to authenticated
  using (public.mi_rol() in ('administrador','auxiliar'));

-- consultas y fórmulas (dato de salud: solo optómetra, administrador y el propio cliente)
create policy consultas_ver on public.consultas for select to authenticated
  using (public.mi_rol() in ('administrador','optometra') or cliente_id = public.mi_cliente());
create policy consultas_crear on public.consultas for insert to authenticated
  with check (public.mi_rol() in ('administrador','optometra') and optometra_id = auth.uid());

-- ventas, pagos y órdenes (se crean solo con las funciones de abajo)
create policy ventas_ver on public.ventas for select to authenticated
  using (public.mi_rol() in ('administrador','vendedor','auxiliar') or cliente_id = public.mi_cliente());
create policy detalle_ver on public.detalle_ventas for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id));
create policy pagos_ver on public.pagos for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id));
create policy ordenes_ver on public.ordenes for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id));
create policy seguimiento_ver on public.seguimiento_ordenes for select to authenticated
  using (exists (select 1 from public.ordenes o where o.id = orden_id));

-- ---------- FUNCIONES DE NEGOCIO (atómicas, validan el rol en el servidor) ----------
create function public.crear_venta(
  p_cliente bigint, p_desc numeric, p_abono numeric, p_forma text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; v_o bigint; it jsonb; pr public.productos%rowtype;
  v_sub numeric := 0; v_cant int; v_lente boolean := false;
begin
  if public.mi_rol() not in ('administrador','vendedor') then
    raise exception 'No tienes permiso para registrar ventas';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into public.ventas (cliente_id, vendedor_id, descuento, total)
  values (p_cliente, auth.uid(), coalesce(p_desc, 0), 0) returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::int;
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad no válida'; end if;

    select * into pr from public.productos
      where id = (it->>'producto_id')::bigint and activo for update;
    if not found then raise exception 'Producto no disponible'; end if;

    if pr.categoria <> 'Servicio' then
      if pr.stock < v_cant then
        raise exception 'Sin stock suficiente de %', pr.codigo;
      end if;
      update public.productos set stock = stock - v_cant where id = pr.id;
      insert into public.movimientos_inventario (producto_id, usuario_id, tipo, cantidad, motivo)
      values (pr.id, auth.uid(), 'salida', v_cant, 'Venta #' || v_id);
    end if;

    insert into public.detalle_ventas (venta_id, producto_id, descripcion, cantidad, precio_unitario)
    values (v_id, pr.id, pr.codigo || ' ' || pr.descripcion, v_cant, pr.precio);

    v_sub := v_sub + pr.precio * v_cant;
    if pr.categoria = 'Lente' then v_lente := true; end if;
  end loop;

  if coalesce(p_desc, 0) < 0 or coalesce(p_desc, 0) > v_sub then
    raise exception 'Descuento no válido';
  end if;
  if coalesce(p_abono, 0) < 0 or coalesce(p_abono, 0) > v_sub - coalesce(p_desc, 0) then
    raise exception 'Abono no válido';
  end if;

  update public.ventas set total = v_sub - coalesce(p_desc, 0) where id = v_id;

  if coalesce(p_abono, 0) > 0 then
    insert into public.pagos (venta_id, usuario_id, monto, forma_pago)
    values (v_id, auth.uid(), p_abono, coalesce(p_forma, 'efectivo'));
  end if;

  if v_lente then
    insert into public.ordenes (venta_id) values (v_id) returning id into v_o;
    insert into public.seguimiento_ordenes (orden_id, usuario_id, estado) values (v_o, auth.uid(), 0);
  end if;
  return v_id;
end $$;

create function public.registrar_abono(p_venta bigint, p_monto numeric, p_forma text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.ventas%rowtype; v_pag numeric;
begin
  if public.mi_rol() not in ('administrador','vendedor') then
    raise exception 'No tienes permiso para registrar abonos';
  end if;
  select * into v from public.ventas where id = p_venta for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  select coalesce(sum(monto), 0) into v_pag from public.pagos where venta_id = p_venta;
  if p_monto <= 0 or p_monto > v.total - v_pag then raise exception 'Abono no válido'; end if;
  insert into public.pagos (venta_id, usuario_id, monto, forma_pago)
  values (p_venta, auth.uid(), p_monto, coalesce(p_forma, 'efectivo'));
end $$;

create function public.avanzar_orden(p_orden bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o public.ordenes%rowtype; v public.ventas%rowtype; v_pag numeric;
begin
  if public.mi_rol() not in ('administrador','auxiliar') then
    raise exception 'No tienes permiso para avanzar órdenes';
  end if;
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if o.estado >= 6 then raise exception 'La orden ya fue entregada'; end if;
  select * into v from public.ventas where id = o.venta_id;
  select coalesce(sum(monto), 0) into v_pag from public.pagos where venta_id = o.venta_id;
  if o.estado = 5 and v.total - v_pag > 0 then
    raise exception 'No se puede entregar: hay saldo pendiente';
  end if;
  update public.ordenes
    set estado = o.estado + 1,
        fecha_entrega = case when o.estado + 1 = 6 then now() else null end
    where id = p_orden;
  insert into public.seguimiento_ordenes (orden_id, usuario_id, estado)
  values (p_orden, auth.uid(), o.estado + 1);
end $$;

create function public.entrada_stock(p_producto bigint, p_cantidad int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mi_rol() not in ('administrador','auxiliar') then
    raise exception 'No tienes permiso para ingresar inventario';
  end if;
  if p_cantidad <= 0 then raise exception 'Cantidad no válida'; end if;
  update public.productos set stock = stock + p_cantidad where id = p_producto;
  if not found then raise exception 'Producto no encontrado'; end if;
  insert into public.movimientos_inventario (producto_id, usuario_id, tipo, cantidad, motivo)
  values (p_producto, auth.uid(), 'entrada', p_cantidad, 'Ingreso de mercancía');
end $$;

-- Solo usuarios con sesión pueden llamar las funciones
revoke all on function public.crear_venta(bigint, numeric, numeric, text, jsonb) from public, anon;
revoke all on function public.registrar_abono(bigint, numeric, text) from public, anon;
revoke all on function public.avanzar_orden(bigint) from public, anon;
revoke all on function public.entrada_stock(bigint, int) from public, anon;
grant execute on function public.crear_venta(bigint, numeric, numeric, text, jsonb) to authenticated;
grant execute on function public.registrar_abono(bigint, numeric, text) to authenticated;
grant execute on function public.avanzar_orden(bigint) to authenticated;
grant execute on function public.entrada_stock(bigint, int) to authenticated;
