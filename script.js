const K='optica_v1';
let D={clientes:[],productos:[],ventas:[],ordenes:[],n:1};
try{const s=localStorage.getItem(K);if(s)D=JSON.parse(s)}catch(e){}
D.users=D.users||[];D.formulas=D.formulas||[];
const save=()=>{try{localStorage.setItem(K,JSON.stringify(D))}catch(e){}};
const $=s=>document.querySelector(s),v=id=>($('#'+id)||{}).value||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cop=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
const fh=t=>new Date(t).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'});
const EST=['Orden creada','Enviada al laboratorio','En producción','Recibida','Control de calidad','Lista para entrega','Entregada'];
const TABS=[['inicio','Inicio'],['clientes','Clientes'],['consultas','Consultas'],['productos','Productos'],['ventas','Ventas'],['ordenes','Órdenes'],['usuarios','Usuarios'],['micuenta','Mi cuenta']];
const RN={administrador:'Administrador',optometra:'Optómetra',vendedor:'Vendedor',auxiliar:'Auxiliar',cliente:'Cliente'};
const PERM={administrador:['inicio','clientes','consultas','productos','ventas','ordenes','usuarios'],optometra:['inicio','clientes','consultas'],vendedor:['inicio','clientes','ventas','ordenes'],auxiliar:['inicio','productos','ordenes'],cliente:['micuenta']};
const ACT={addCli:['administrador','optometra','vendedor'],addProd:['administrador'],entrada:['administrador','auxiliar'],venta:['administrador','vendedor'],abonar:['administrador','vendedor'],avanzar:['administrador','auxiliar'],consulta:['administrador','optometra'],usuarios:['administrador']};
let me=null;const can=a=>!!me&&ACT[a].includes(me.rol),NP='No tienes permiso para esto.';
let tab='inicio',q='',cart=[],sale={cli:'',desc:'',abono:'',forma:'efectivo'};
const tot=s=>s.lines.reduce((a,l)=>a+l.pu*l.c,0)-(s.desc||0);
const pag=s=>s.pagos.reduce((a,p)=>a+p.m,0);
const cli=id=>D.clientes.find(c=>c.id==id)||{nombre:'(eliminado)'};
const prod=id=>D.productos.find(p=>p.id==id)||{};
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2800)}
function go(t){tab=t;q='';render()}
function nav(){$('#nav').innerHTML=TABS.filter(([k])=>PERM[me.rol].includes(k)).map(([k,n])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${n}</button>`).join('')}
function render(){
 if(!me){$('#nav').innerHTML='';$('#who').innerHTML='';$('#app').innerHTML=D.users.length?V.login():V.setup();return}
 if(!PERM[me.rol].includes(tab))tab=PERM[me.rol][0];
 nav();$('#who').innerHTML=esc(me.nombre)+' · '+RN[me.rol]+' <button class="btn s" onclick="salir()">Salir</button>';
 $('#app').innerHTML=V[tab]();if($('#lista'))lista();window.scrollTo(0,0)}
function setQ(x){q=x.toLowerCase();lista()}
function lista(){$('#lista').innerHTML=L[tab]()}

const V={
inicio(){
 const bajos=D.productos.filter(p=>p.activo!==false&&p.stock<=p.min),act=D.ordenes.filter(o=>o.e<6),
 listas=D.ordenes.filter(o=>o.e==5),cobrar=D.ventas.reduce((a,s)=>a+(tot(s)-pag(s)),0);
 return `<h2>Resumen</h2><div class="grid">
 <div class="card stat"><b>${D.clientes.length}</b><span>Clientes</span></div>
 <div class="card stat"><b>${act.length}</b><span>Órdenes en proceso</span></div>
 <div class="card stat"><b>${bajos.length}</b><span>Productos con poco stock</span></div>
 <div class="card stat"><b>${cop(cobrar)}</b><span>Saldo por cobrar</span></div></div>
 <div class="card"><h3>Listas para entregar</h3>${listas.map(o=>{const s=D.ventas.find(x=>x.id==o.vid);return `<div class="item"><span>Orden #${o.id} · ${esc(cli(s.cid).nombre)}</span><span class="tag ${tot(s)-pag(s)>0?'w':'o'}">${tot(s)-pag(s)>0?'Saldo '+cop(tot(s)-pag(s)):'Pagada'}</span></div>`}).join('')||'<div class="empty">Ninguna por ahora.</div>'}</div>
 <div class="card"><h3>Reponer inventario</h3>${bajos.map(p=>`<div class="item"><span>${esc(p.cod)} · ${esc(p.marca)} ${esc(p.desc)}</span><span class="tag b">${p.stock} en stock</span></div>`).join('')||'<div class="empty">Todo en orden.</div>'}</div>
 ${D.clientes.length||D.productos.length||me.rol!='administrador'?'':'<div class="card"><h3>¿Quieres probar la app?</h3><p class="mut">Carga clientes y productos de ejemplo. Puedes borrarlos después.</p><button class="btn" onclick="demo()">Cargar datos de ejemplo</button></div>'}
 <p class="mut">Los datos se guardan solo en este navegador y dispositivo.</p>`},
clientes(){return `<h2>Clientes</h2><div class="card"><h3>Nuevo cliente</h3><div class="row">
 <div><label for="c_doc">Documento *</label><input id="c_doc"></div><div><label for="c_nom">Nombre *</label><input id="c_nom"></div>
 <div><label for="c_tel">Teléfono</label><input id="c_tel" type="tel"></div><div><label for="c_cor">Correo</label><input id="c_cor" type="email"></div>
 <div><label for="c_nac">Nacimiento</label><input id="c_nac" type="date"></div><div><label for="c_con">Autoriza uso de datos</label><select id="c_con"><option value="1">Sí</option><option value="">No</option></select></div>
 <button class="btn" onclick="addCli()">Guardar cliente</button></div></div>
 <div class="card"><input placeholder="Buscar por documento, nombre o teléfono" oninput="setQ(this.value)" aria-label="Buscar cliente"><div id="lista"></div></div>`},
productos(){return `<h2>Productos</h2>${can('addProd')?'':'<!--'}<div class="card"><h3>Nuevo producto</h3><div class="row">
 <div><label for="p_cod">Código *</label><input id="p_cod"></div>
 <div><label for="p_cat">Categoría</label><select id="p_cat"><option>Montura</option><option>Lente</option><option>Accesorio</option><option>Servicio</option></select></div>
 <div><label for="p_mar">Marca</label><input id="p_mar"></div><div><label for="p_des">Descripción *</label><input id="p_des"></div>
 <div><label for="p_pre">Precio (COP) *</label><input id="p_pre" type="number" min="0"></div>
 <div><label for="p_sto">Existencias</label><input id="p_sto" type="number" min="0" value="0"></div>
 <div><label for="p_min">Stock mínimo</label><input id="p_min" type="number" min="0" value="2"></div>
 <button class="btn" onclick="addProd()">Guardar producto</button></div></div>${can('addProd')?'':'-->'}
 <div class="card"><input placeholder="Buscar por código, marca, descripción o categoría" oninput="setQ(this.value)" aria-label="Buscar producto"><div id="lista"></div></div>`},
ventas(){
 const ps=D.productos.filter(p=>p.activo!==false&&(p.stock>0||p.cat=='Servicio'));
 const sub=cart.reduce((a,l)=>a+l.pu*l.c,0);
 return `<h2>Ventas</h2><div class="card"><h3>Nueva venta</h3><div class="row">
 <div><label for="s_cli">Cliente *</label><select id="s_cli"><option value="">Selecciona…</option>${D.clientes.map(c=>`<option value="${c.id}" ${sale.cli==c.id?'selected':''}>${esc(c.nombre)} · ${esc(c.doc)}</option>`).join('')}</select></div>
 <div><label for="s_pro">Producto</label><select id="s_pro">${ps.map(p=>`<option value="${p.id}">${esc(p.cod)} · ${esc(p.marca)} ${esc(p.desc)} (${p.stock})</option>`).join('')}</select></div>
 <div><label for="s_can">Cantidad</label><input id="s_can" type="number" min="1" value="1"></div>
 <button class="btn s" onclick="addLine()">Agregar</button></div>
 ${cart.map((l,i)=>`<div class="item"><span>${l.c} × ${esc(l.n)}</span><span class="inl">${cop(l.pu*l.c)} <button class="btn s" onclick="rmLine(${i})" aria-label="Quitar">Quitar</button></span></div>`).join('')||'<div class="empty">Agrega al menos un producto.</div>'}
 <div class="row" style="margin-top:10px"><div><label for="s_des">Descuento (COP)</label><input id="s_des" type="number" min="0" value="${esc(sale.desc)}"></div>
 <div><label for="s_abo">Abono inicial (COP)</label><input id="s_abo" type="number" min="0" value="${esc(sale.abono)}"></div>
 <div><label for="s_for">Forma de pago</label><select id="s_for">${['efectivo','tarjeta','transferencia','otro'].map(f=>`<option ${sale.forma==f?'selected':''}>${f}</option>`).join('')}</select></div>
 <button class="btn" onclick="crearVenta()">Registrar venta · ${cop(sub-(+sale.desc||0))}</button></div></div>
 <div class="card"><h3>Historial</h3><div id="lista"></div></div>`},
ordenes(){return `<h2>Órdenes de lentes</h2><div class="card"><div id="lista"></div></div>`}
};

const L={
inicio(){return ''},
clientes(){const r=D.clientes.filter(c=>(c.doc+c.nombre+c.tel).toLowerCase().includes(q));
 return r.map(c=>{const n=D.ventas.filter(s=>s.cid==c.id).length;return `<div class="item"><div><b>${esc(c.nombre)}</b><div class="mut">CC ${esc(c.doc)} · ${esc(c.tel)||'sin teléfono'} · ${esc(c.cor)}</div></div><span class="tag">${n} compra${n==1?'':'s'}</span></div>`}).join('')||'<div class="empty">Sin clientes. Registra el primero arriba.</div>'},
productos(){const r=D.productos.filter(p=>(p.cod+p.marca+p.desc+p.cat).toLowerCase().includes(q));
 return r.map(p=>`<div class="item"><div><b>${esc(p.cod)}</b> · ${esc(p.marca)} ${esc(p.desc)}<div class="mut">${p.cat} · ${cop(p.pre)}</div></div>
 <div class="inl"><span class="tag ${p.stock==0?'b':p.stock<=p.min?'w':'o'}">${p.stock} en stock</span>${can('entrada')?`<input id="in${p.id}" type="number" min="1" placeholder="+ unidades" aria-label="Unidades a ingresar"><button class="btn s" onclick="entrada(${p.id})">Ingresar</button>`:''}</div></div>`).join('')||'<div class="empty">Sin productos. Registra el primero arriba.</div>'},
ventas(){return [...D.ventas].reverse().map(s=>{const t=tot(s),sa=t-pag(s);return `<div class="item"><div><b>Venta #${s.id}</b> · ${esc(cli(s.cid).nombre)}<div class="mut">${fh(s.f)} · ${s.lines.map(l=>l.c+'× '+esc(l.n)).join(', ')}</div></div>
 <div class="inl"><span>${cop(t)}</span>${sa>0?`<span class="tag w">Saldo ${cop(sa)}</span><input id="ab${s.id}" type="number" min="1" placeholder="Abono"><button class="btn s" onclick="abonar(${s.id})">Abonar</button>`:'<span class="tag o">Pagada</span>'}</div></div>`}).join('')||'<div class="empty">Aún no hay ventas.</div>'},
ordenes(){return [...D.ordenes].reverse().map(o=>{const s=D.ventas.find(x=>x.id==o.vid),sa=tot(s)-pag(s);return `<div class="item" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span><b>Orden #${o.id}</b> · ${esc(cli(s.cid).nombre)} <span class="mut">(venta #${s.id})</span></span><span class="tag ${o.e==6?'o':''}">${EST[o.e]}</span></div>
 <div class="steps">${EST.map((_,i)=>`<i class="${i<=o.e?'d':''}"></i>`).join('')}</div>
 <div class="inl" style="justify-content:space-between;flex-wrap:wrap"><span class="mut">Último cambio: ${fh(o.h[o.h.length-1].t)}${sa>0?' · saldo '+cop(sa):''}</span>${o.e<6&&can('avanzar')?`<button class="btn s" onclick="avanzar(${o.id})">Pasar a: ${EST[o.e+1]}</button>`:''}</div></div>`}).join('')||'<div class="empty">Las órdenes se crean solas al vender un lente.</div>'}
};

function addCli(){if(!can('addCli'))return toast(NP);const d=v('c_doc').trim(),n=v('c_nom').trim();
 if(!d||!n)return toast('Documento y nombre son obligatorios.');
 if(D.clientes.some(c=>c.doc==d))return toast('Ya existe un cliente con ese documento.');
 D.clientes.push({id:D.n++,doc:d,nombre:n,tel:v('c_tel'),cor:v('c_cor'),nac:v('c_nac'),con:!!v('c_con'),f:Date.now()});
 save();render();toast('Cliente guardado.')}
function addProd(){if(!can('addProd'))return toast(NP);const c=v('p_cod').trim().toUpperCase(),d=v('p_des').trim(),pr=+v('p_pre');
 if(!c||!d||!(pr>=0)||v('p_pre')==='')return toast('Código, descripción y precio son obligatorios.');
 if(D.productos.some(p=>p.cod==c))return toast('Ese código ya existe.');
 D.productos.push({id:D.n++,cod:c,cat:v('p_cat'),marca:v('p_mar'),desc:d,pre:pr,stock:Math.max(0,+v('p_sto')||0),min:Math.max(0,+v('p_min')||0),activo:true});
 save();render();toast('Producto guardado.')}
function entrada(id){if(!can('entrada'))return toast(NP);const n=Math.floor(+v('in'+id));if(!(n>0))return toast('Escribe cuántas unidades ingresan.');
 prod(id).stock+=n;save();lista();toast('Inventario actualizado.')}
function sync(){sale={cli:v('s_cli'),desc:v('s_des'),abono:v('s_abo'),forma:v('s_for')||'efectivo'}}
function addLine(){sync();const p=prod(+v('s_pro')),c=Math.floor(+v('s_can'));
 if(!p.id)return toast('No hay productos disponibles.');if(!(c>0))return toast('Cantidad no válida.');
 const ya=cart.filter(l=>l.pid==p.id).reduce((a,l)=>a+l.c,0);
 if(p.cat!='Servicio'&&ya+c>p.stock)return toast('Solo quedan '+p.stock+' en stock.');
 cart.push({pid:p.id,n:p.cod+' '+p.desc,pu:p.pre,c});render()}
function rmLine(i){sync();cart.splice(i,1);render()}
function crearVenta(){if(!can('venta'))return toast(NP);sync();const d=+sale.desc||0,ab=+sale.abono||0;
 if(!sale.cli)return toast('Selecciona un cliente.');if(!cart.length)return toast('Agrega al menos un producto.');
 const sub=cart.reduce((a,l)=>a+l.pu*l.c,0);
 if(d<0||d>sub)return toast('El descuento no puede superar el subtotal.');
 if(ab<0||ab>sub-d)return toast('El abono no puede superar el total.');
 const s={id:D.n++,cid:+sale.cli,f:Date.now(),lines:cart.map(l=>({...l})),desc:d,pagos:ab?[{m:ab,fp:sale.forma,t:Date.now()}]:[]};
 s.lines.forEach(l=>{const p=prod(l.pid);if(p.cat!='Servicio')p.stock-=l.c});
 D.ventas.push(s);
 if(s.lines.some(l=>prod(l.pid).cat=='Lente')){const id=D.n++;D.ordenes.push({id,vid:s.id,e:0,h:[{e:0,t:Date.now()}]})}
 cart=[];sale={cli:'',desc:'',abono:'',forma:'efectivo'};save();render();toast('Venta registrada.')}
function abonar(id){if(!can('abonar'))return toast(NP);const s=D.ventas.find(x=>x.id==id),m=+v('ab'+id),sa=tot(s)-pag(s);
 if(!(m>0))return toast('Escribe el valor del abono.');if(m>sa)return toast('El abono supera el saldo ('+cop(sa)+').');
 s.pagos.push({m,fp:'efectivo',t:Date.now()});save();lista();toast('Abono registrado.')}
function avanzar(id){if(!can('avanzar'))return toast(NP);const o=D.ordenes.find(x=>x.id==id),s=D.ventas.find(x=>x.id==o.vid);
 if(o.e==5&&tot(s)-pag(s)>0)return toast('No se puede entregar: hay saldo pendiente.');
 o.e++;o.h.push({e:o.e,t:Date.now()});save();lista();toast('Orden: '+EST[o.e]+'.')}
function demo(){const b=Date.now();
 [['1001','Ana Torres','3001112233'],['1002','Luis Pérez','3105556677']].forEach(([d,n,t])=>D.clientes.push({id:D.n++,doc:d,nombre:n,tel:t,cor:'',nac:'',con:true,f:b}));
 [['MON-01','Montura','RayLite','Montura acetato negra',180000,6],['LEN-01','Lente','Zeiss','Lente antirreflejo',250000,10],['ACC-01','Accesorio','','Estuche rígido',15000,1]].forEach(([c,k,m,d,p,s])=>D.productos.push({id:D.n++,cod:c,cat:k,marca:m,desc:d,pre:p,stock:s,min:2,activo:true}));
 save();render()}
async function hash(c,p){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.toLowerCase()+'|'+p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
V.setup=()=>`<div class="card login"><h2>Primer uso</h2><p class="mut">Crea la cuenta del administrador de la óptica.</p><div class="row">
<div><label for="u_nom">Nombre</label><input id="u_nom"></div><div><label for="u_cor">Correo</label><input id="u_cor" type="email"></div>
<div><label for="u_pas">Contraseña (mínimo 6)</label><input id="u_pas" type="password"></div><button class="btn" onclick="setup()">Crear administrador</button></div></div>`;
V.login=()=>`<div class="card login"><h2>Iniciar sesión</h2><div class="row">
<div><label for="l_cor">Correo o usuario (ej. vendedor)</label><input id="l_cor" autocapitalize="none" autocomplete="username"></div><div><label for="l_pas">Contraseña</label><input id="l_pas" type="password" onkeydown="if(event.key=='Enter')login()"></div>
<button class="btn" onclick="login()">Entrar</button></div></div>`;
async function setup(){const n=v('u_nom').trim(),c=v('u_cor').trim().toLowerCase(),p=v('u_pas');
 if(!n||!c||p.length<6)return toast('Completa los datos (contraseña de 6 o más caracteres).');
 D.users.push({id:D.n++,nombre:n,cor:c,h:await hash(c,p),rol:'administrador',activo:true});save();toast('Administrador creado. Inicia sesión.');render()}
async function login(){const c=v('l_cor').trim().toLowerCase(),pw=v('l_pas');
 const us=D.users.filter(x=>x.cor==c||x.cor.split('@')[0]==c);
 if(!us.length)return toast('No existe un usuario con ese correo.');
 for(const u of us){if(u.h==await hash(u.cor,pw)){if(!u.activo)return toast('Ese usuario está desactivado.');me=u;tab=PERM[u.rol][0];return render()}}
 toast('Contraseña incorrecta.')}
function salir(){me=null;render()}

V.usuarios=()=>`<h2>Usuarios</h2><div class="card"><h3>Nuevo usuario</h3><div class="row">
<div><label for="nu_nom">Nombre *</label><input id="nu_nom"></div><div><label for="nu_cor">Correo *</label><input id="nu_cor" type="email"></div>
<div><label for="nu_pas">Contraseña * (mínimo 6)</label><input id="nu_pas" type="password"></div>
<div><label for="nu_rol">Rol</label><select id="nu_rol">${Object.keys(RN).map(r=>`<option value="${r}">${RN[r]}</option>`).join('')}</select></div>
<div><label for="nu_cli">Si es cliente, vincular a</label><select id="nu_cli"><option value="">—</option>${D.clientes.map(c=>`<option value="${c.id}">${esc(c.nombre)} · ${esc(c.doc)}</option>`).join('')}</select></div>
<button class="btn" onclick="addUser()">Crear usuario</button></div></div><div class="card"><h3>Probar los roles</h3><p class="mut">Crea un usuario de ejemplo por rol (correo rol@optica.com, contraseña demo123). Desactívalos antes de usar la app de verdad.</p><button class="btn s" onclick="demoUsers()">Crear usuarios de ejemplo</button></div><div class="card"><h3>Empezar de cero</h3><p class="mut">Borra todos los datos de este navegador y vuelve a mostrar el registro del administrador.</p><button class="btn s" onclick="resetAll()">Borrar todo y reiniciar</button></div><div class="card"><div id="lista"></div></div>`;
L.usuarios=()=>D.users.map(u=>`<div class="item"><div><b>${esc(u.nombre)}</b><div class="mut">${esc(u.cor)}</div></div><div class="inl"><span class="tag">${RN[u.rol]}</span><span class="tag ${u.activo?'o':'b'}">${u.activo?'Activo':'Inactivo'}</span>${u.id!=me.id?`<button class="btn s" onclick="toggleUser(${u.id})">${u.activo?'Desactivar':'Reactivar'}</button>`:''}</div></div>`).join('');
async function addUser(){if(!can('usuarios'))return toast(NP);
 const n=v('nu_nom').trim(),c=v('nu_cor').trim().toLowerCase(),p=v('nu_pas'),r=v('nu_rol'),cl=v('nu_cli');
 if(!n||!c||p.length<6)return toast('Nombre, correo y contraseña (6 o más) son obligatorios.');
 if(D.users.some(u=>u.cor==c))return toast('Ya existe un usuario con ese correo.');
 if(r=='cliente'&&!cl)return toast('Un usuario cliente debe vincularse a un cliente registrado.');
 D.users.push({id:D.n++,nombre:n,cor:c,h:await hash(c,p),rol:r,cid:r=='cliente'?+cl:null,activo:true});save();render();toast('Usuario creado.')}
function toggleUser(id){if(!can('usuarios'))return toast(NP);const u=D.users.find(x=>x.id==id);if(u.id==me.id)return;u.activo=!u.activo;save();lista()}

const fx=f=>`OD ${f.od.join(' / ')} · OI ${f.oi.join(' / ')} · Adición ${f.ad||'-'} · DP ${f.dp||'-'} · ${esc(f.tipo)}`;
V.consultas=()=>`<h2>Consulta visual y fórmula</h2>${can('consulta')?`<div class="card"><h3>Nueva consulta</h3><div class="row">
<div><label for="f_cli">Cliente *</label><select id="f_cli"><option value="">Selecciona…</option>${D.clientes.map(c=>`<option value="${c.id}">${esc(c.nombre)} · ${esc(c.doc)}</option>`).join('')}</select></div>
<div><label for="f_mot">Motivo de consulta</label><input id="f_mot"></div>
${[['od','OD (ojo derecho)'],['oi','OI (ojo izquierdo)']].map(([k,t])=>['esf','cil','eje'].map(x=>`<div><label for="f_${k}${x}">${t} ${x}</label><input id="f_${k}${x}" type="number" step="0.25"></div>`).join('')).join('')}
<div><label for="f_ad">Adición</label><input id="f_ad" type="number" step="0.25"></div><div><label for="f_dp">DP (mm)</label><input id="f_dp" type="number" step="0.5"></div>
<div><label for="f_tip">Tipo de lente</label><select id="f_tip"><option>Monofocal</option><option>Bifocal</option><option>Progresivo</option></select></div>
<div><label for="f_obs">Observaciones</label><input id="f_obs"></div><button class="btn" onclick="addFormula()">Guardar fórmula</button></div></div>`:''}
<div class="card"><input placeholder="Buscar por nombre o documento" oninput="setQ(this.value)" aria-label="Buscar consulta"><div id="lista"></div></div>`;
L.consultas=()=>D.formulas.filter(f=>(cli(f.cid).nombre+(cli(f.cid).doc||'')).toLowerCase().includes(q)).reverse().map(f=>`<div class="item"><div><b>${esc(cli(f.cid).nombre)}</b> <span class="mut">${fh(f.f)} · ${esc(f.opt)}</span><div class="mut">${fx(f)}${f.mot?' · '+esc(f.mot):''}${f.obs?' · '+esc(f.obs):''}</div></div></div>`).join('')||'<div class="empty">Sin consultas registradas.</div>';
function addFormula(){if(!can('consulta'))return toast(NP);if(!v('f_cli'))return toast('Selecciona un cliente.');
 const g=(k)=>['esf','cil','eje'].map(x=>v('f_'+k+x)||'0');
 D.formulas.push({id:D.n++,cid:+v('f_cli'),opt:me.nombre,f:Date.now(),mot:v('f_mot'),od:g('od'),oi:g('oi'),ad:v('f_ad'),dp:v('f_dp'),tipo:v('f_tip'),obs:v('f_obs')});
 save();render();toast('Fórmula guardada.')}
V.micuenta=()=>{const c=D.clientes.find(x=>x.id==me.cid);
 if(!c)return '<div class="card empty">Tu cuenta aún no está vinculada a un cliente. Consulta en la óptica.</div>';
 const fs=D.formulas.filter(f=>f.cid==c.id).reverse(),os=D.ordenes.filter(o=>(D.ventas.find(s=>s.id==o.vid)||{}).cid==c.id).reverse();
 return `<h2>Hola, ${esc(c.nombre)}</h2><div class="card"><h3>Mis órdenes</h3>${os.map(o=>`<div class="item" style="display:block"><b>Orden #${o.id}</b> <span class="tag ${o.e==6?'o':''}">${EST[o.e]}</span><div class="steps">${EST.map((_,i)=>`<i class="${i<=o.e?'d':''}"></i>`).join('')}</div><div class="mut">Último cambio: ${fh(o.h[o.h.length-1].t)}</div></div>`).join('')||'<div class="empty">Aún no tienes órdenes.</div>'}</div>
 <div class="card"><h3>Mi fórmula</h3>${fs.map(f=>`<div class="item"><div>${fh(f.f)}<div class="mut">${fx(f)}</div></div></div>`).join('')||'<div class="empty">Aún no hay fórmula registrada.</div>'}</div>`};
L.micuenta=()=>'';

async function demoUsers(){if(!can('usuarios'))return toast(NP);
 let c=D.clientes[0];if(!c){c={id:D.n++,doc:'1001',nombre:'Ana Torres',tel:'3001112233',cor:'',nac:'',con:true,f:Date.now()};D.clientes.push(c)}
 let n=0;for(const r of ['optometra','vendedor','auxiliar','cliente']){const e=r+'@optica.com';if(D.users.some(u=>u.cor==e))continue;
  D.users.push({id:D.n++,nombre:RN[r]+' de ejemplo',cor:e,h:await hash(e,'demo123'),rol:r,cid:r=='cliente'?c.id:null,activo:true});n++}
 save();render();toast(n?'Usuarios de ejemplo creados.':'Los usuarios de ejemplo ya existen.')}

let rst=0;
function resetAll(){if(!can('usuarios'))return toast(NP);
 if(Date.now()-rst>5000){rst=Date.now();return toast('Esto borra TODOS los datos. Pulsa de nuevo en 5 segundos para confirmar.')}
 D={clientes:[],productos:[],ventas:[],ordenes:[],users:[],formulas:[],n:1};save();me=null;cart=[];render()}

render();