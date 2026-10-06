/* Óptica · app conectada a Supabase */
const cfg=window.OPTICA_CONFIG||{};
const sb=(window.supabase&&cfg.url&&cfg.key&&!cfg.url.includes('TU-PROYECTO'))?window.supabase.createClient(cfg.url,cfg.key):null;
const $=s=>document.querySelector(s),v=id=>($('#'+id)||{}).value||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cop=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
const fh=t=>new Date(t).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'});
const EST=['Orden creada','Enviada al laboratorio','En producción','Recibida','Control de calidad','Lista para entrega','Entregada'];
const TABS=[['inicio','Inicio'],['clientes','Clientes'],['consultas','Consultas'],['productos','Productos'],['ventas','Ventas'],['ordenes','Órdenes'],['usuarios','Usuarios'],['micuenta','Mi cuenta']];
const RN={administrador:'Administrador',optometra:'Optómetra',vendedor:'Vendedor',auxiliar:'Auxiliar',cliente:'Cliente'};
const PERM={administrador:['inicio','clientes','consultas','productos','ventas','ordenes','usuarios'],optometra:['inicio','clientes','consultas'],vendedor:['inicio','clientes','ventas','ordenes'],auxiliar:['inicio','productos','ordenes'],cliente:['micuenta']};
const ACT={addCli:['administrador','optometra','vendedor'],addProd:['administrador'],entrada:['administrador','auxiliar'],venta:['administrador','vendedor'],abonar:['administrador','vendedor'],avanzar:['administrador','auxiliar'],consulta:['administrador','optometra'],usuarios:['administrador']};
const NP='No tienes permiso para esto.';
const vacio=()=>({clientes:[],productos:[],ventas:[],ordenes:[],consultas:[],perfiles:[]});
let D=vacio(),me=null,tab='inicio',q='',cart=[],sale={cli:'',desc:'',abono:'',forma:'efectivo'};
const can=a=>!!me&&ACT[a].includes(me.rol);
const tot=s=>+s.total,pag=s=>(s.pagos||[]).reduce((a,p)=>a+ +p.monto,0),sal=s=>tot(s)-pag(s);
const cli=id=>D.clientes.find(c=>c.id==id)||{nombre:'(sin acceso)',documento:''};
const prod=id=>D.productos.find(p=>p.id==id)||{};
const ult=o=>(o.seguimiento_ordenes||[]).reduce((m,x)=>x.fecha>m?x.fecha:m,o.creado_en);
const num=id=>v(id)===''?null:+v(id);

function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3200)}
const ex=async p=>{const r=await p;if(r.error)throw r.error;return r.data};
async function run(f,ok){try{await f();if(ok)toast(ok)}catch(e){toast(e.code=='23505'?'Ya existe un registro con ese código o documento.':(e.message||'Ocurrió un error.'))}}
async function load(){
 [D.clientes,D.productos,D.ventas,D.ordenes,D.consultas]=(await Promise.all([
  ex(sb.from('clientes').select('*').order('nombre')),
  ex(sb.from('productos').select('*').order('codigo')),
  ex(sb.from('ventas').select('*,detalle_ventas(*),pagos(*)').order('id',{ascending:false})),
  ex(sb.from('ordenes').select('*,seguimiento_ordenes(*)').order('id',{ascending:false})),
  ex(sb.from('consultas').select('*').order('fecha',{ascending:false}))])).map(x=>x||[]);
 D.perfiles=me.rol=='administrador'?(await ex(sb.from('perfiles').select('*').order('creado_en')))||[]:[];
}

/* ---------- sesión ---------- */
let modo='usuario',vista='login',hayAdmin=true;
async function cargarHayAdmin(){try{const r=await sb.rpc('hay_admin');hayAdmin=r.data!==false}catch(e){hayAdmin=true}}
async function perfil(){const {data:{session}}=await sb.auth.getSession();if(!session)return 0;
 const r=await sb.from('perfiles').select('*').eq('id',session.user.id).maybeSingle();return r.data||null}
async function entrar(m){
 let p=await perfil();if(p===0)return render();
 if(m=='admin'&&p&&p.rol!='administrador'&&!hayAdmin){await sb.rpc('volverme_admin');await cargarHayAdmin();p=await perfil()}
 if(!p||!p.activo){await sb.auth.signOut();toast('Usuario sin acceso o desactivado.');return render()}
 if(m=='admin'&&p.rol!='administrador'){await sb.auth.signOut();toast('Esta cuenta no es de administrador. Usa "Soy usuario".');return render()}
 if(m=='usuario'&&p.rol=='administrador'){await sb.auth.signOut();toast('Esta cuenta es de administrador. Usa "Soy administrador".');return render()}
 me=p;tab=PERM[me.rol][0];$('#app').innerHTML='<p class="mut">Cargando…</p>';
 try{await load()}catch(e){toast(e.message)}render()}
async function login(){
 const r=await sb.auth.signInWithPassword({email:v('l_cor').trim(),password:v('l_pas')});
 if(r.error)return toast(r.error.message.toLowerCase().includes('confirm')?'Primero confirma tu correo (revisa tu bandeja).':'Correo o contraseña incorrectos.');
 await entrar(modo)}
function setModo(m){const e=v('l_cor');modo=m;render();if(e&&$('#l_cor'))$('#l_cor').value=e}
function irVista(x){vista=x;render()}
async function registrar(adm){
 const n=v('r_nom').trim().slice(0,80),c=v('r_cor').trim(),pw=v('r_pas');
 if(!n||!c)return toast('Completa tu nombre y tu correo.');
 if(pw.length<6)return toast('La contraseña debe tener 6 o más caracteres.');
 if(pw!=v('r_pas2'))return toast('Las contraseñas no coinciden.');
 const r=await sb.auth.signUp({email:c,password:pw,options:{data:{nombre:n}}});
 if(r.error)return toast(r.error.message);
 const conSesion=!!(r.data&&r.data.session);if(conSesion)await sb.auth.signOut();
 vista='login';modo=adm?'admin':'usuario';render();
 toast(conSesion?'Cuenta creada. Ya puedes iniciar sesión.':'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')}
const campoReg=`<div><label for="r_nom">Nombre completo</label><input id="r_nom" autocomplete="name"></div>
<div><label for="r_cor">Correo</label><input id="r_cor" type="email" autocomplete="username"></div>
<div><label for="r_pas">Contraseña (mínimo 6)</label><input id="r_pas" type="password" autocomplete="new-password"></div>
<div><label for="r_pas2">Repite la contraseña</label><input id="r_pas2" type="password" autocomplete="new-password"></div>`;
const enlace=(t,x)=>`<a href="#" style="color:var(--pri)" onclick="irVista('${x}');return false">${t}</a>`;
function vistaLogin(){
 if(vista=='registro')return `<div class="card login"><h2>Crear cuenta</h2><p class="mut">Con tu cuenta podrás consultar tus órdenes y tu fórmula. La óptica debe vincularla a tu ficha de cliente para que veas tus datos.</p><div class="row">${campoReg}<button class="btn" onclick="registrar(false)">Crear mi cuenta</button></div><p class="mut" style="margin-top:14px">${enlace('Ya tengo cuenta, iniciar sesión','login')}</p></div>`;
 if(vista=='regadmin')return `<div class="card login"><h2>Registrar administrador</h2><p class="mut">Solo se puede hacer una vez. Quien inicie sesión como administrador después de registrarse queda como administrador de la óptica.</p><div class="row">${campoReg}<button class="btn" onclick="registrar(true)">Registrar administrador</button></div><p class="mut" style="margin-top:14px">${enlace('Volver a iniciar sesión','login')}</p></div>`;
 const ad=modo=='admin';
 return `<div class="card login"><h2>Iniciar sesión</h2>
 <div class="inl" style="margin-bottom:12px"><button class="btn ${ad?'s':''}" onclick="setModo('usuario')">Soy usuario</button><button class="btn ${ad?'':'s'}" onclick="setModo('admin')">Soy administrador</button></div>
 <div class="row"><div><label for="l_cor">Correo</label><input id="l_cor" type="email" autocomplete="username"></div>
 <div><label for="l_pas">Contraseña</label><input id="l_pas" type="password" autocomplete="current-password" onkeydown="if(event.key=='Enter')login()"></div>
 <button class="btn" onclick="login()">Entrar como ${ad?'administrador':'usuario'}</button></div>
 <p class="mut" style="margin-top:14px">${ad?(hayAdmin?'':'¿Primera vez? '+enlace('Registrar al administrador','regadmin')):'¿No tienes cuenta? '+enlace('Regístrate aquí','registro')}</p></div>`}
async function salir(){await sb.auth.signOut();me=null;D=vacio();cart=[];vista='login';render()}

/* ---------- navegación ---------- */
function go(t){tab=t;q='';render()}
function nav(){$('#nav').innerHTML=TABS.filter(([k])=>PERM[me.rol].includes(k)).map(([k,n])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${n}</button>`).join('')}
function render(){
 if(!me){$('#nav').innerHTML='';$('#who').innerHTML='';$('#app').innerHTML=sb?V.login():V.config();return}
 if(!PERM[me.rol].includes(tab))tab=PERM[me.rol][0];
 nav();$('#who').innerHTML=esc(me.nombre)+' · '+RN[me.rol]+' <button class="btn s" onclick="salir()">Salir</button>';
 $('#app').innerHTML=V[tab]();if($('#lista'))lista();window.scrollTo(0,0)}
function setQ(x){q=x.toLowerCase();lista()}
function lista(){$('#lista').innerHTML=L[tab]()}
const fx=f=>`OD ${[f.od_esfera,f.od_cilindro,f.od_eje].map(x=>x??0).join(' / ')} · OI ${[f.oi_esfera,f.oi_cilindro,f.oi_eje].map(x=>x??0).join(' / ')} · Adición ${f.adicion??'-'} · DP ${f.dp??'-'} · ${esc(f.tipo_lente)}`;
const pasos=o=>`<div class="steps">${EST.map((_,i)=>`<i class="${i<=o.estado?'d':''}"></i>`).join('')}</div>`;

/* ---------- pantallas ---------- */
const V={
config:()=>`<div class="card login"><h2>Falta configurar</h2><p class="mut">Abre el archivo <b>config.js</b> y pega la URL y la clave anon de tu proyecto de Supabase.</p></div>`,
login:()=>vistaLogin(),
inicio(){
 const bajos=D.productos.filter(p=>p.activo&&p.stock<=p.stock_minimo),act=D.ordenes.filter(o=>o.estado<6),
 listas=D.ordenes.filter(o=>o.estado==5),cobrar=D.ventas.reduce((a,s)=>a+sal(s),0);
 return `<h2>Resumen</h2><div class="grid">
 <div class="card stat"><b>${D.clientes.length}</b><span>Clientes</span></div>
 <div class="card stat"><b>${act.length}</b><span>Órdenes en proceso</span></div>
 <div class="card stat"><b>${bajos.length}</b><span>Productos con poco stock</span></div>
 <div class="card stat"><b>${cop(cobrar)}</b><span>Saldo por cobrar</span></div></div>
 <div class="card"><h3>Listas para entregar</h3>${listas.map(o=>{const s=D.ventas.find(x=>x.id==o.venta_id);return s?`<div class="item"><span>Orden #${o.id} · ${esc(cli(s.cliente_id).nombre)}</span><span class="tag ${sal(s)>0?'w':'o'}">${sal(s)>0?'Saldo '+cop(sal(s)):'Pagada'}</span></div>`:''}).join('')||'<div class="empty">Ninguna por ahora.</div>'}</div>
 <div class="card"><h3>Reponer inventario</h3>${bajos.map(p=>`<div class="item"><span>${esc(p.codigo)} · ${esc(p.marca)} ${esc(p.descripcion)}</span><span class="tag b">${p.stock} en stock</span></div>`).join('')||'<div class="empty">Todo en orden.</div>'}</div>`},
clientes:()=>`<h2>Clientes</h2><div class="card"><h3>Nuevo cliente</h3><div class="row">
 <div><label for="c_doc">Documento *</label><input id="c_doc"></div><div><label for="c_nom">Nombre *</label><input id="c_nom"></div>
 <div><label for="c_tel">Teléfono</label><input id="c_tel" type="tel"></div><div><label for="c_cor">Correo</label><input id="c_cor" type="email"></div>
 <div><label for="c_nac">Nacimiento</label><input id="c_nac" type="date"></div><div><label for="c_con">Autoriza uso de datos</label><select id="c_con"><option value="1">Sí</option><option value="">No</option></select></div>
 <button class="btn" onclick="addCli()">Guardar cliente</button></div></div>
 <div class="card"><input placeholder="Buscar por documento, nombre o teléfono" oninput="setQ(this.value)" aria-label="Buscar cliente"><div id="lista"></div></div>`,
consultas:()=>`<h2>Consulta visual y fórmula</h2>${can('consulta')?`<div class="card"><h3>Nueva consulta</h3><div class="row">
 <div><label for="f_cli">Cliente *</label><select id="f_cli"><option value="">Selecciona…</option>${D.clientes.map(c=>`<option value="${c.id}">${esc(c.nombre)} · ${esc(c.documento)}</option>`).join('')}</select></div>
 <div><label for="f_mot">Motivo de consulta</label><input id="f_mot"></div>
 ${[['od','OD (ojo derecho)'],['oi','OI (ojo izquierdo)']].map(([k,t])=>['esf','cil','eje'].map(x=>`<div><label for="f_${k}${x}">${t} ${x}</label><input id="f_${k}${x}" type="number" step="0.25"></div>`).join('')).join('')}
 <div><label for="f_ad">Adición</label><input id="f_ad" type="number" step="0.25"></div><div><label for="f_dp">DP (mm)</label><input id="f_dp" type="number" step="0.5"></div>
 <div><label for="f_tip">Tipo de lente</label><select id="f_tip"><option>Monofocal</option><option>Bifocal</option><option>Progresivo</option></select></div>
 <div><label for="f_obs">Observaciones</label><input id="f_obs"></div><button class="btn" onclick="addFormula()">Guardar fórmula</button></div></div>`:''}
 <div class="card"><input placeholder="Buscar por nombre o documento" oninput="setQ(this.value)" aria-label="Buscar consulta"><div id="lista"></div></div>`,
productos:()=>`<h2>Productos</h2>${can('addProd')?`<div class="card"><h3>Nuevo producto</h3><div class="row">
 <div><label for="p_cod">Código *</label><input id="p_cod"></div>
 <div><label for="p_cat">Categoría</label><select id="p_cat"><option>Montura</option><option>Lente</option><option>Accesorio</option><option>Servicio</option></select></div>
 <div><label for="p_mar">Marca</label><input id="p_mar"></div><div><label for="p_des">Descripción *</label><input id="p_des"></div>
 <div><label for="p_pre">Precio (COP) *</label><input id="p_pre" type="number" min="0"></div>
 <div><label for="p_sto">Existencias</label><input id="p_sto" type="number" min="0" value="0"></div>
 <div><label for="p_min">Stock mínimo</label><input id="p_min" type="number" min="0" value="2"></div>
 <button class="btn" onclick="addProd()">Guardar producto</button></div></div>`:''}
 <div class="card"><input placeholder="Buscar por código, marca, descripción o categoría" oninput="setQ(this.value)" aria-label="Buscar producto"><div id="lista"></div></div>`,
ventas(){
 const ps=D.productos.filter(p=>p.activo&&(p.stock>0||p.categoria=='Servicio')),sub=cart.reduce((a,l)=>a+l.pu*l.c,0);
 return `<h2>Ventas</h2><div class="card"><h3>Nueva venta</h3><div class="row">
 <div><label for="s_cli">Cliente *</label><select id="s_cli"><option value="">Selecciona…</option>${D.clientes.map(c=>`<option value="${c.id}" ${sale.cli==c.id?'selected':''}>${esc(c.nombre)} · ${esc(c.documento)}</option>`).join('')}</select></div>
 <div><label for="s_pro">Producto</label><select id="s_pro">${ps.map(p=>`<option value="${p.id}">${esc(p.codigo)} · ${esc(p.marca)} ${esc(p.descripcion)} (${p.stock})</option>`).join('')}</select></div>
 <div><label for="s_can">Cantidad</label><input id="s_can" type="number" min="1" value="1"></div>
 <button class="btn s" onclick="addLine()">Agregar</button></div>
 ${cart.map((l,i)=>`<div class="item"><span>${l.c} × ${esc(l.n)}</span><span class="inl">${cop(l.pu*l.c)} <button class="btn s" onclick="rmLine(${i})" aria-label="Quitar">Quitar</button></span></div>`).join('')||'<div class="empty">Agrega al menos un producto.</div>'}
 <div class="row" style="margin-top:10px"><div><label for="s_des">Descuento (COP)</label><input id="s_des" type="number" min="0" value="${esc(sale.desc)}"></div>
 <div><label for="s_abo">Abono inicial (COP)</label><input id="s_abo" type="number" min="0" value="${esc(sale.abono)}"></div>
 <div><label for="s_for">Forma de pago</label><select id="s_for">${['efectivo','tarjeta','transferencia','otro'].map(f=>`<option ${sale.forma==f?'selected':''}>${f}</option>`).join('')}</select></div>
 <button class="btn" onclick="crearVenta()">Registrar venta · ${cop(sub-(+sale.desc||0))}</button></div></div>
 <div class="card"><h3>Historial</h3><div id="lista"></div></div>`},
ordenes:()=>`<h2>Órdenes de lentes</h2><div class="card"><div id="lista"></div></div>`,
usuarios:()=>`<h2>Usuarios</h2><div class="card"><p class="mut">Para crear un usuario nuevo: en Supabase abre <b>Authentication → Users → Add user</b>. Aparecerá aquí como <b>Cliente</b> y tú le cambias el rol. Si el rol es Cliente, vincúlalo a su ficha de cliente.</p></div><div class="card"><div id="lista"></div></div>`,
micuenta(){
 const c=D.clientes.find(x=>x.id==me.cliente_id);
 if(!c)return '<div class="card empty">Tu cuenta aún no está vinculada a un cliente. Consulta en la óptica.</div>';
 const fs=D.consultas.filter(f=>f.cliente_id==c.id);
 return `<h2>Hola, ${esc(c.nombre)}</h2><div class="card"><h3>Mis órdenes</h3>${D.ordenes.map(o=>`<div class="item" style="display:block"><b>Orden #${o.id}</b> <span class="tag ${o.estado==6?'o':''}">${EST[o.estado]}</span>${pasos(o)}<div class="mut">Último cambio: ${fh(ult(o))}</div></div>`).join('')||'<div class="empty">Aún no tienes órdenes.</div>'}</div>
 <div class="card"><h3>Mi fórmula</h3>${fs.map(f=>`<div class="item"><div>${fh(f.fecha)}<div class="mut">${fx(f)}</div></div></div>`).join('')||'<div class="empty">Aún no hay fórmula registrada.</div>'}</div>`}
};

/* ---------- listados ---------- */
const L={
inicio:()=>'',micuenta:()=>'',
clientes(){const r=D.clientes.filter(c=>(c.documento+c.nombre+(c.telefono||'')).toLowerCase().includes(q));
 return r.map(c=>{const n=D.ventas.filter(s=>s.cliente_id==c.id).length;return `<div class="item"><div><b>${esc(c.nombre)}</b><div class="mut">CC ${esc(c.documento)} · ${esc(c.telefono)||'sin teléfono'} · ${esc(c.correo)}</div></div><span class="tag">${n} compra${n==1?'':'s'}</span></div>`}).join('')||'<div class="empty">Sin clientes.</div>'},
consultas:()=>D.consultas.filter(f=>(cli(f.cliente_id).nombre+cli(f.cliente_id).documento).toLowerCase().includes(q)).map(f=>`<div class="item"><div><b>${esc(cli(f.cliente_id).nombre)}</b> <span class="mut">${fh(f.fecha)}</span><div class="mut">${fx(f)}${f.motivo?' · '+esc(f.motivo):''}${f.observaciones?' · '+esc(f.observaciones):''}</div></div></div>`).join('')||'<div class="empty">Sin consultas registradas.</div>',
productos(){const r=D.productos.filter(p=>(p.codigo+(p.marca||'')+p.descripcion+p.categoria).toLowerCase().includes(q));
 return r.map(p=>`<div class="item"><div><b>${esc(p.codigo)}</b> · ${esc(p.marca)} ${esc(p.descripcion)}<div class="mut">${p.categoria} · ${cop(p.precio)}</div></div>
 <div class="inl"><span class="tag ${p.stock==0?'b':p.stock<=p.stock_minimo?'w':'o'}">${p.stock} en stock</span>${can('entrada')?`<input id="in${p.id}" type="number" min="1" placeholder="+ unidades" aria-label="Unidades a ingresar"><button class="btn s" onclick="entrada(${p.id})">Ingresar</button>`:''}</div></div>`).join('')||'<div class="empty">Sin productos.</div>'},
ventas:()=>D.ventas.map(s=>{const sa=sal(s);return `<div class="item"><div><b>Venta #${s.id}</b> · ${esc(cli(s.cliente_id).nombre)}<div class="mut">${fh(s.fecha)} · ${(s.detalle_ventas||[]).map(l=>l.cantidad+'× '+esc(l.descripcion)).join(', ')}</div></div>
 <div class="inl"><span>${cop(tot(s))}</span>${sa>0?`<span class="tag w">Saldo ${cop(sa)}</span><input id="ab${s.id}" type="number" min="1" placeholder="Abono"><button class="btn s" onclick="abonar(${s.id})">Abonar</button>`:'<span class="tag o">Pagada</span>'}</div></div>`}).join('')||'<div class="empty">Aún no hay ventas.</div>',
ordenes:()=>D.ordenes.map(o=>{const s=D.ventas.find(x=>x.id==o.venta_id)||{total:0,pagos:[]},sa=sal(s);return `<div class="item" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span><b>Orden #${o.id}</b> · ${esc(cli(s.cliente_id).nombre)} <span class="mut">(venta #${o.venta_id})</span></span><span class="tag ${o.estado==6?'o':''}">${EST[o.estado]}</span></div>${pasos(o)}
 <div class="inl" style="justify-content:space-between;flex-wrap:wrap"><span class="mut">Último cambio: ${fh(ult(o))}${sa>0?' · saldo '+cop(sa):''}</span>${o.estado<6&&can('avanzar')?`<button class="btn s" onclick="avanzar(${o.id})">Pasar a: ${EST[o.estado+1]}</button>`:''}</div></div>`}).join('')||'<div class="empty">Las órdenes se crean solas al vender un lente.</div>',
usuarios:()=>D.perfiles.map(u=>{const yo=u.id==me.id?'disabled':'';return `<div class="item"><div><b>${esc(u.nombre)}</b></div><div class="inl">
 <select aria-label="Rol" ${yo} onchange="setPerfil('${u.id}',{rol:this.value})">${Object.keys(RN).map(r=>`<option value="${r}" ${u.rol==r?'selected':''}>${RN[r]}</option>`).join('')}</select>
 ${u.rol=='cliente'?`<select aria-label="Cliente vinculado" onchange="setPerfil('${u.id}',{cliente_id:this.value||null})"><option value="">Sin vincular</option>${D.clientes.map(c=>`<option value="${c.id}" ${u.cliente_id==c.id?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select>`:''}
 <span class="tag ${u.activo?'o':'b'}">${u.activo?'Activo':'Inactivo'}</span>${yo?'':`<button class="btn s" onclick="setPerfil('${u.id}',{activo:${!u.activo}})">${u.activo?'Desactivar':'Reactivar'}</button>`}</div></div>`}).join('')
};

/* ---------- acciones (el servidor vuelve a validar el rol) ---------- */
const refrescar=async()=>{await load();render()};
function addCli(){if(!can('addCli'))return toast(NP);const d=v('c_doc').trim(),n=v('c_nom').trim();
 if(!d||!n)return toast('Documento y nombre son obligatorios.');
 run(async()=>{await ex(sb.from('clientes').insert({documento:d,nombre:n,telefono:v('c_tel'),correo:v('c_cor'),fecha_nacimiento:v('c_nac')||null,consentimiento_datos:!!v('c_con')}));await refrescar()},'Cliente guardado.')}
function addProd(){if(!can('addProd'))return toast(NP);const c=v('p_cod').trim().toUpperCase(),d=v('p_des').trim();
 if(!c||!d||v('p_pre')==='')return toast('Código, descripción y precio son obligatorios.');
 run(async()=>{await ex(sb.from('productos').insert({codigo:c,categoria:v('p_cat'),marca:v('p_mar'),descripcion:d,precio:+v('p_pre'),stock:Math.max(0,+v('p_sto')||0),stock_minimo:Math.max(0,+v('p_min')||0)}));await refrescar()},'Producto guardado.')}
function entrada(id){if(!can('entrada'))return toast(NP);const n=Math.floor(+v('in'+id));if(!(n>0))return toast('Escribe cuántas unidades ingresan.');
 run(async()=>{await ex(sb.rpc('entrada_stock',{p_producto:id,p_cantidad:n}));await load();lista()},'Inventario actualizado.')}
function sync(){sale={cli:v('s_cli'),desc:v('s_des'),abono:v('s_abo'),forma:v('s_for')||'efectivo'}}
function addLine(){sync();const p=prod(+v('s_pro')),c=Math.floor(+v('s_can'));
 if(!p.id)return toast('No hay productos disponibles.');if(!(c>0))return toast('Cantidad no válida.');
 const ya=cart.filter(l=>l.pid==p.id).reduce((a,l)=>a+l.c,0);
 if(p.categoria!='Servicio'&&ya+c>p.stock)return toast('Solo quedan '+p.stock+' en stock.');
 cart.push({pid:p.id,n:p.codigo+' '+p.descripcion,pu:+p.precio,c});render()}
function rmLine(i){sync();cart.splice(i,1);render()}
function crearVenta(){if(!can('venta'))return toast(NP);sync();
 if(!sale.cli)return toast('Selecciona un cliente.');if(!cart.length)return toast('Agrega al menos un producto.');
 run(async()=>{await ex(sb.rpc('crear_venta',{p_cliente:+sale.cli,p_desc:+sale.desc||0,p_abono:+sale.abono||0,p_forma:sale.forma,p_items:cart.map(l=>({producto_id:l.pid,cantidad:l.c}))}));
  cart=[];sale={cli:'',desc:'',abono:'',forma:'efectivo'};await refrescar()},'Venta registrada.')}
function abonar(id){if(!can('abonar'))return toast(NP);const m=+v('ab'+id);if(!(m>0))return toast('Escribe el valor del abono.');
 run(async()=>{await ex(sb.rpc('registrar_abono',{p_venta:id,p_monto:m,p_forma:'efectivo'}));await load();lista()},'Abono registrado.')}
function avanzar(id){if(!can('avanzar'))return toast(NP);
 run(async()=>{await ex(sb.rpc('avanzar_orden',{p_orden:id}));await load();lista()},'Orden actualizada.')}
function addFormula(){if(!can('consulta'))return toast(NP);if(!v('f_cli'))return toast('Selecciona un cliente.');
 run(async()=>{await ex(sb.from('consultas').insert({cliente_id:+v('f_cli'),optometra_id:me.id,motivo:v('f_mot'),od_esfera:num('f_odesf'),od_cilindro:num('f_odcil'),od_eje:num('f_odeje'),oi_esfera:num('f_oiesf'),oi_cilindro:num('f_oicil'),oi_eje:num('f_oieje'),adicion:num('f_ad'),dp:num('f_dp'),tipo_lente:v('f_tip'),observaciones:v('f_obs')}));await refrescar()},'Fórmula guardada.')}
function setPerfil(id,patch){if(!can('usuarios'))return toast(NP);
 run(async()=>{await ex(sb.from('perfiles').update(patch).eq('id',id));await load();lista()},'Guardado.')}

sb?cargarHayAdmin().then(()=>entrar()):render();
