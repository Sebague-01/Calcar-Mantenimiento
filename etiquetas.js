// ══════════════════════════════════════════════════════════════
// ETIQUETAS — código de barras Code 128 para ítems de stock
// Módulo independiente: se engancha solo al catálogo (#sv-catalogo)
// Usa: S.items (lista cargada en pantalla), JsBarcode (se carga solo desde CDN)
// Configuración editable desde el propio diálogo; se guarda en localStorage.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';

const LS_KEY='calcar_etq_cfg_v1';
const LIB_URL='https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';

// Ancho de cinta (mm) → alto útil de impresión aprox. y tamaños de letra sugeridos.
// VALORES ESTÁNDAR Brother P-touch (aprox.). Si tu modelo difiere, se ajusta en el diálogo.
const CINTAS={
  6 :{alto:4.5 ,desc:false,descPt:0,codePt:5},
  9 :{alto:7.3 ,desc:false,descPt:0,codePt:6},
  12:{alto:9.9 ,desc:false,descPt:0,codePt:7},
  18:{alto:15.8,desc:true ,descPt:5,codePt:7},
  24:{alto:18  ,desc:true ,descPt:6,codePt:8}
};

const DEF={
  modo:'cinta',            // 'cinta' (rotuladora) | 'a4' (hoja autoadhesiva)
  cinta:24,                // ancho de cinta en mm
  alto:18,                 // alto útil de impresión en mm (cinta)
  largoModo:'auto',        // 'auto' (según el código más largo del lote) | 'fijo'
  largoMm:50,              // largo si es fijo
  largoMin:30,             // largo mínimo en modo auto
  giro:false,              // girar 90° (algunos drivers piden la cinta en vertical)
  moduloMm:0.28,           // ancho de la barra más fina (≈ 2 puntos a 180 dpi)
  quietMm:2.5,             // zona en blanco a cada lado del código de barras
  padX:1.5,                // margen lateral de la etiqueta (mm)
  padY:0.6,                // margen vertical interno (mm)
  mostrarDesc:true,
  descPt:6,
  codePt:8,
  mostrarMarca:false,      // agrega marca/modelo a la línea de descripción
  mostrarUbic:false,       // agrega la ubicación junto al código legible
  sinGuiones:true,         // códigos internos CC-SS-TT-PPP-NNNN → solo dígitos en el barcode
  a4:{cols:3,rows:7,w:63.5,h:38.1,mTop:15.1,mLeft:7.2,gapX:2.5,gapY:0} // Avery L7160 / equivalentes
};

let cfg=cargarCfg();
const sel=new Map();   // codigo → copias
let libPromise=null;

function clon(o){return JSON.parse(JSON.stringify(o));}
function cargarCfg(){
  const c=clon(DEF);
  try{
    const s=JSON.parse(localStorage.getItem(LS_KEY)||'null');
    if(s){ Object.keys(s).forEach(k=>{ if(k==='a4') Object.assign(c.a4,s.a4); else if(k in c) c[k]=s[k]; }); }
  }catch(e){}
  return c;
}
function guardarCfg(){ try{localStorage.setItem(LS_KEY,JSON.stringify(cfg));}catch(e){} }
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function r2(n){return Math.round(n*100)/100;}

// ── Valor que va dentro del código de barras ──
// Internos (CC-SS-TT-PPP-NNNN): 13 dígitos sin guiones (Code 128 los comprime de a pares).
// De fábrica (TBA8 / Stork / ESSI): el P/N tal cual figura en el campo codigo.
function valorBarcode(cod){
  cod=String(cod||'').trim();
  if(cfg.sinGuiones && /^\d{2}-\d{2}-\d{2}-\d{3}-\d{4}$/.test(cod)) return cod.replace(/-/g,'');
  return cod;
}
// Para el futuro escáner: dado el texto leído, devuelve los códigos candidatos a buscar en stock_items.codigo
window.etqCandidatosEscaneo=function(raw){
  raw=String(raw||'').trim();
  const out=[raw];
  if(/^\d{13}$/.test(raw)) out.push(raw.replace(/^(\d{2})(\d{2})(\d{2})(\d{3})(\d{4})$/,'$1-$2-$3-$4-$5'));
  return out;
};

// ── Librería de barras ──
function ensureLib(){
  if(window.JsBarcode) return Promise.resolve();
  if(libPromise) return libPromise;
  libPromise=new Promise((ok,fail)=>{
    const s=document.createElement('script'); s.src=LIB_URL;
    s.onload=()=>ok(); s.onerror=()=>{libPromise=null;fail(new Error('No se pudo cargar JsBarcode'));};
    document.head.appendChild(s);
  });
  return libPromise;
}
function barcodeData(valor){
  const q=Math.max(8,Math.round(cfg.quietMm/cfg.moduloMm));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  window.JsBarcode(svg,valor,{format:'CODE128',width:1,height:50,displayValue:false,margin:0,marginLeft:q,marginRight:q,background:'#ffffff',lineColor:'#000000'});
  let w,h;
  const vb=svg.getAttribute('viewBox');
  if(vb){const p=vb.split(/[\s,]+/).map(Number); w=p[2]; h=p[3];}
  else { w=parseFloat(svg.getAttribute('width')); h=parseFloat(svg.getAttribute('height')); }
  return {w:w,h:h,inner:svg.innerHTML};
}

// ── Geometría del lote ──
function geometria(bcs){
  const a4=cfg.modo==='a4';
  const maxW=bcs.reduce((m,b)=>Math.max(m,b.w),0);
  const L=a4?cfg.a4.w:(cfg.largoModo==='fijo'?cfg.largoMm:Math.max(cfg.largoMin,r2(maxW*cfg.moduloMm+2*cfg.padX)));
  const H=a4?cfg.a4.h:cfg.cinta;
  const boxH=a4?cfg.a4.h:Math.min(cfg.alto,cfg.cinta);
  return {L:L,H:H,boxH:boxH,maxBar:L-2*cfg.padX};
}

const LB_CSS=
 '.lb{box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}'
+'.bx{box-sizing:border-box;width:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden}'
+'.ds{width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;text-align:center}'
+'.br{flex:1;min-height:0;width:100%;display:flex;justify-content:center;align-items:stretch}'
+'.br svg{display:block;height:100%}'
+'.cd{width:100%;display:flex;gap:2mm;font-family:"Courier New",Courier,monospace;font-weight:700;line-height:1.1;white-space:nowrap}';

function labelHTML(it,bc,g){
  const barW=Math.min(bc.w*cfg.moduloMm,g.maxBar);
  const mod=barW/bc.w;
  const descTxt=[it.desc, cfg.mostrarMarca?[it.marca,it.modelo].filter(Boolean).join(' '):''].filter(Boolean).join(' · ');
  const showD=cfg.mostrarDesc && cfg.descPt>0 && descTxt;
  const ubic=cfg.mostrarUbic && it.ubicacion;
  const html='<div class="lb" style="width:'+g.L+'mm;height:'+g.H+'mm">'
   +'<div class="bx" style="height:'+g.boxH+'mm;padding:'+cfg.padY+'mm '+cfg.padX+'mm">'
   +(showD?'<div class="ds" style="font-size:'+cfg.descPt+'pt">'+esc(descTxt)+'</div>':'')
   +'<div class="br"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+bc.w+' '+bc.h+'" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:'+r2(barW)+'mm">'+bc.inner+'</svg></div>'
   +'<div class="cd" style="font-size:'+cfg.codePt+'pt;justify-content:'+(ubic?'space-between':'center')+'"><span>'+esc(it.cod)+'</span>'+(ubic?'<span>'+esc(it.ubicacion)+'</span>':'')+'</div>'
   +'</div></div>';
  return {html:html,mod:mod};
}

// ── Construcción del lote (items ya expandidos por copias) ──
async function construir(items){
  await ensureLib();
  const cache={}, errores=[];
  const ok=[];
  items.forEach(it=>{
    const v=valorBarcode(it.cod);
    if(!(v in cache)){
      try{ cache[v]=barcodeData(v); }catch(e){ cache[v]=null; }
    }
    if(cache[v]) ok.push({it:it,bc:cache[v]}); else if(errores.indexOf(it.cod)<0) errores.push(it.cod);
  });
  const g=geometria(ok.map(o=>o.bc));
  let minMod=Infinity;
  const labels=ok.map(o=>{ const r=labelHTML(o.it,o.bc,g); minMod=Math.min(minMod,r.mod); return r.html; });
  return {labels:labels,g:g,errores:errores,minMod:minMod};
}

function docHTML(res){
  const g=res.g, a4=cfg.modo==='a4';
  let css='@page{size:', body='';
  if(!a4){
    const rot=cfg.giro;
    css+=(rot?g.H+'mm '+g.L+'mm':g.L+'mm '+g.H+'mm')+';margin:0}';
    css+='.pg{width:'+(rot?g.H:g.L)+'mm;height:'+(rot?g.L:g.H)+'mm;overflow:hidden;break-after:page;page-break-after:always;position:relative}';
    css+='.pg:last-child{break-after:auto;page-break-after:auto}';
    if(rot) css+='.rot{position:absolute;left:0;top:0;transform-origin:0 0;transform:translateX('+g.H+'mm) rotate(90deg)}';
    body=res.labels.map(l=>'<div class="pg">'+(rot?'<div class="rot">'+l+'</div>':l)+'</div>').join('');
  }else{
    const A=cfg.a4, per=A.cols*A.rows;
    css+='A4 portrait;margin:0}';
    css+='.pg{width:210mm;height:297mm;box-sizing:border-box;padding:'+A.mTop+'mm 0 0 '+A.mLeft+'mm;display:grid;grid-template-columns:repeat('+A.cols+','+A.w+'mm);grid-auto-rows:'+A.h+'mm;column-gap:'+A.gapX+'mm;row-gap:'+A.gapY+'mm;align-content:start;break-after:page;page-break-after:always;overflow:hidden}';
    css+='.pg:last-child{break-after:auto;page-break-after:auto}';
    for(let i=0;i<res.labels.length;i+=per) body+='<div class="pg">'+res.labels.slice(i,i+per).join('')+'</div>';
  }
  css+='html,body{margin:0;padding:0;background:#fff}'+LB_CSS;
  css+='@media screen{body{background:#e8e8e8;padding:12px}.pg{background:#fff;margin:0 0 12px;box-shadow:0 0 4px #888}.noprint{display:block}}@media print{.noprint{display:none}}';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas</title><style>'+css+'</style></head><body>'
   +'<div class="noprint" style="font:13px Arial;margin-bottom:10px">'+res.labels.length+' etiqueta(s). En el diálogo de impresión: márgenes <b>Ninguno</b>, escala <b>100%</b>, tamaño de papel = cinta/hoja instalada. <button onclick="window.print()">Imprimir</button></div>'
   +body
   +'<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>';
}

// ── Selección de ítems ──
function itemsSeleccionados(){
  const out=[];
  (window.S&&S.items||[]).forEach(it=>{
    if(sel.has(it.cod)){ const n=Math.max(1,parseInt(sel.get(it.cod))||1); for(let i=0;i<n;i++) out.push(it); }
  });
  return out;
}

async function imprimir(){
  const items=itemsSeleccionados();
  if(!items.length){alert('Marcá al menos un producto.');return;}
  let res;
  try{ res=await construir(items); }catch(e){ alert('No se pudo generar el código de barras: '+e.message+'\n(¿hay conexión para cargar la librería JsBarcode?)'); return; }
  if(res.errores.length) alert('Estos códigos no se pueden codificar en Code 128 y se omitieron:\n'+res.errores.join('\n'));
  if(!res.labels.length) return;
  const w=window.open('','_blank');
  if(!w){alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio e intentá de nuevo.');return;}
  w.document.write(docHTML(res));
  w.document.close();
}

// ── Interfaz ──
const CSS=
'#etq-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto}'
+'#etq-ov.open{display:flex}'
+'#etq-box{background:#fff;border-radius:12px;width:100%;max-width:1060px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:13px;color:#1a1a18}'
+'.etq-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e5e4de;font-weight:700;font-size:15px}'
+'.etq-h button{background:none;border:none;font-size:20px;cursor:pointer;color:#666}'
+'.etq-g{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:0}'
+'.etq-l{padding:14px 18px;border-right:1px solid #e5e4de;min-width:0}'
+'.etq-r{padding:14px 18px;background:#fafaf7}'
+'.etq-tools{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}'
+'.etq-tools input[type=text]{flex:1;min-width:120px;padding:6px 8px;border:1px solid #d0cfc9;border-radius:8px;font:inherit}'
+'.etq-list{max-height:430px;overflow-y:auto;border:1px solid #e5e4de;border-radius:8px}'
+'.etq-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #f0efe9}'
+'.etq-row:last-child{border-bottom:none}'
+'.etq-row .c{font-family:monospace;font-size:12px;min-width:150px;color:#333}'
+'.etq-row .d{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'.etq-row input[type=number]{width:46px;padding:2px 4px;border:1px solid #d0cfc9;border-radius:6px}'
+'.etq-cnt{font-size:12px;color:#666;margin-top:6px}'
+'.etq-cfg{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-bottom:10px}'
+'.etq-cfg label{display:flex;flex-direction:column;gap:2px;font-size:11px;color:#555}'
+'.etq-cfg label.chk{flex-direction:row;align-items:center;gap:6px;font-size:12px;color:#1a1a18;grid-column:1/3}'
+'.etq-cfg input[type=number],.etq-cfg select{padding:5px 6px;border:1px solid #d0cfc9;border-radius:6px;font:inherit;font-size:12px;width:100%;box-sizing:border-box}'
+'.etq-sec{font-weight:700;font-size:12px;margin:10px 0 4px;color:#1D9E75}'
+'.etq-prev{background:#fff;border:1px dashed #bbb;border-radius:8px;padding:10px;min-height:70px;overflow:auto;margin-bottom:8px;text-align:center}'
+'.etq-prev .in{display:inline-block;border:1px solid #ccc;line-height:0}'
+'.etq-warn{color:#b45309;font-size:12px;margin-bottom:6px}'
+'.etq-hint{font-size:11px;color:#777;margin-top:8px;line-height:1.4}'
+'.etq-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;border-top:1px solid #e5e4de}'
+'@media(max-width:820px){.etq-g{grid-template-columns:1fr}.etq-l{border-right:none}}'
+LB_CSS.replace(/\.(lb|bx|ds|br|cd)\b/g,'.etq-prev .$1');

function campo(k,t,paso){return '<label>'+t+'<input type="number" step="'+(paso||'any')+'" data-k="'+k+'"></label>';}
function chk(k,t){return '<label class="chk"><input type="checkbox" data-k="'+k+'"> '+t+'</label>';}

function construirDOM(){
  if(document.getElementById('etq-ov')) return;
  const st=document.createElement('style'); st.id='etq-css'; st.textContent=CSS; document.head.appendChild(st);
  const ov=document.createElement('div'); ov.id='etq-ov';
  ov.innerHTML=
   '<div id="etq-box">'
  +'<div class="etq-h"><span><i class="ti ti-barcode"></i> Etiquetas con código de barras (Code 128)</span><button id="etq-x" title="Cerrar">×</button></div>'
  +'<div class="etq-g">'
  +'<div class="etq-l">'
  +'<div class="etq-tools"><input type="text" id="etq-q" placeholder="Filtrar la lista…">'
  +'<button class="btn-sec" id="etq-all">Marcar visibles</button><button class="btn-sec" id="etq-none">Desmarcar todo</button></div>'
  +'<div class="etq-list" id="etq-list"></div>'
  +'<div class="etq-cnt" id="etq-cnt"></div>'
  +'<div class="etq-hint">La lista es la del catálogo en pantalla: filtrá allí por categoría, proveedor o máquina y volvé a abrir este diálogo. Cada ítem usa el campo <i>codigo</i> tal cual (internos y P/N de fábrica). En largo automático todas las etiquetas del lote miden lo mismo (la del código más largo): imprimí por separado los códigos de fábrica largos.</div>'
  +'</div>'
  +'<div class="etq-r">'
  +'<div class="etq-sec">Vista previa</div><div class="etq-prev" id="etq-prev"></div><div class="etq-warn" id="etq-warn"></div>'
  +'<div class="etq-sec">Formato</div><div class="etq-cfg">'
  +'<label>Modo<select data-k="modo"><option value="cinta">Cinta (rotuladora)</option><option value="a4">Hoja A4 adhesiva</option></select></label>'
  +'<span class="etq-m-cinta"><label>Ancho de cinta<select data-k="cinta"><option value="6">6 mm</option><option value="9">9 mm</option><option value="12">12 mm</option><option value="18">18 mm</option><option value="24">24 mm</option></select></label></span>'
  +'</div>'
  +'<div class="etq-cfg etq-m-cinta">'
  +campo('alto','Alto útil (mm)','0.1')
  +'<label>Largo<select data-k="largoModo"><option value="auto">Automático</option><option value="fijo">Fijo</option></select></label>'
  +campo('largoMm','Largo fijo (mm)','1')+campo('largoMin','Largo mínimo auto (mm)','1')
  +chk('giro','Girar 90° (si el driver pide la cinta en vertical)')
  +'</div>'
  +'<div class="etq-cfg etq-m-a4">'
  +campo('a4.cols','Columnas','1')+campo('a4.rows','Filas','1')
  +campo('a4.w','Ancho etiqueta (mm)','0.1')+campo('a4.h','Alto etiqueta (mm)','0.1')
  +campo('a4.mTop','Margen superior (mm)','0.1')+campo('a4.mLeft','Margen izquierdo (mm)','0.1')
  +campo('a4.gapX','Separación horiz. (mm)','0.1')+campo('a4.gapY','Separación vert. (mm)','0.1')
  +'</div>'
  +'<div class="etq-sec">Código de barras y texto</div><div class="etq-cfg">'
  +campo('moduloMm','Barra fina (mm)','0.01')+campo('quietMm','Zona en blanco (mm)','0.1')
  +campo('padX','Margen lateral (mm)','0.1')+campo('padY','Margen vertical (mm)','0.1')
  +campo('descPt','Letra descripción (pt)','0.5')+campo('codePt','Letra código (pt)','0.5')
  +chk('mostrarDesc','Mostrar descripción')+chk('mostrarMarca','Agregar marca / modelo a la descripción')
  +chk('mostrarUbic','Mostrar ubicación junto al código')+chk('sinGuiones','Códigos internos: solo dígitos en el barcode (sin guiones)')
  +'</div>'
  +'<button class="btn-sec" id="etq-reset">Restaurar valores estándar</button>'
  +'<div class="etq-hint">Con la rotuladora Brother: en el diálogo de impresión elegí la Brother, tamaño de papel = cinta instalada, márgenes <b>Ninguno</b>, escala <b>100%</b>. Una etiqueta por página; el corte lo define el driver.</div>'
  +'</div></div>'
  +'<div class="etq-foot"><button class="btn-sec" id="etq-cancel">Cerrar</button><button class="btn-primary" id="etq-print"><i class="ti ti-printer"></i> Imprimir</button></div>'
  +'</div>';
  document.body.appendChild(ov);

  ov.addEventListener('click',e=>{ if(e.target===ov) cerrar(); });
  document.getElementById('etq-x').onclick=cerrar;
  document.getElementById('etq-cancel').onclick=cerrar;
  document.getElementById('etq-print').onclick=imprimir;
  document.getElementById('etq-q').oninput=renderLista;
  document.getElementById('etq-all').onclick=()=>{ visibles().forEach(it=>{ if(!sel.has(it.cod)) sel.set(it.cod,1); }); renderLista(); };
  document.getElementById('etq-none').onclick=()=>{ sel.clear(); renderLista(); };
  document.getElementById('etq-reset').onclick=()=>{ cfg=clon(DEF); aplicarPresetCinta(); guardarCfg(); sync(); preview(); };
  ov.addEventListener('input',onCfg); ov.addEventListener('change',onCfg);
}

function getK(k){ return k.indexOf('.')>0 ? cfg[k.split('.')[0]][k.split('.')[1]] : cfg[k]; }
function setK(k,v){ if(k.indexOf('.')>0){ const p=k.split('.'); cfg[p[0]][p[1]]=v; } else cfg[k]=v; }

function aplicarPresetCinta(){
  const p=CINTAS[cfg.cinta]; if(!p) return;
  cfg.alto=p.alto; cfg.mostrarDesc=p.desc; cfg.descPt=p.descPt||cfg.descPt; cfg.codePt=p.codePt; cfg.moduloMm=DEF.moduloMm;
}
function aplicarPresetModo(){
  if(cfg.modo==='a4'){ cfg.descPt=8; cfg.codePt=10; cfg.mostrarDesc=true; cfg.moduloMm=0.33; cfg.padX=2; cfg.padY=2; }
  else { cfg.padX=DEF.padX; cfg.padY=DEF.padY; aplicarPresetCinta(); }
}

function onCfg(e){
  const t=e.target; const k=t.getAttribute&&t.getAttribute('data-k'); if(!k) return;
  let v;
  if(t.type==='checkbox') v=t.checked;
  else if(t.type==='number'){ v=parseFloat(t.value); if(isNaN(v)) return; }
  else v=t.value;
  if(k==='cinta') v=parseInt(v);
  setK(k,v);
  if(k==='cinta'){ aplicarPresetCinta(); sync(); }
  if(k==='modo'){ aplicarPresetModo(); sync(); }
  guardarCfg(); preview();
}

function sync(){
  document.querySelectorAll('#etq-ov [data-k]').forEach(el=>{
    const v=getK(el.getAttribute('data-k'));
    if(el.type==='checkbox') el.checked=!!v; else el.value=v;
  });
  const a4=cfg.modo==='a4';
  document.querySelectorAll('#etq-ov .etq-m-cinta').forEach(el=>el.style.display=a4?'none':'');
  document.querySelectorAll('#etq-ov .etq-m-a4').forEach(el=>el.style.display=a4?'':'none');
}

function visibles(){
  const q=(document.getElementById('etq-q').value||'').toLowerCase().trim();
  return (window.S&&S.items||[]).filter(it=>!q||((it.cod||'')+' '+(it.desc||'')+' '+(it.marca||'')).toLowerCase().indexOf(q)>=0);
}

function renderLista(){
  const arr=visibles();
  const box=document.getElementById('etq-list');
  if(!arr.length){ box.innerHTML='<div style="padding:14px;color:#888;text-align:center">Sin productos en la lista.</div>'; }
  else box.innerHTML=arr.map(it=>{
    const on=sel.has(it.cod);
    return '<div class="etq-row"><input type="checkbox" data-cod="'+esc(it.cod)+'"'+(on?' checked':'')+'>'
      +'<span class="c">'+esc(it.cod)+'</span><span class="d" title="'+esc(it.desc)+'">'+esc(it.desc)+'</span>'
      +'<input type="number" min="1" max="99" value="'+(on?sel.get(it.cod):1)+'" data-cp="'+esc(it.cod)+'"'+(on?'':' disabled')+' title="Copias"></div>';
  }).join('');
  box.querySelectorAll('input[data-cod]').forEach(cb=>cb.onchange=()=>{
    const c=cb.getAttribute('data-cod'); if(cb.checked) sel.set(c,sel.get(c)||1); else sel.delete(c);
    const n=box.querySelector('input[data-cp="'+(window.CSS&&CSS.escape?CSS.escape(c):c)+'"]'); if(n) n.disabled=!cb.checked;
    contador(); preview();
  });
  box.querySelectorAll('input[data-cp]').forEach(n=>n.oninput=()=>{ const c=n.getAttribute('data-cp'); if(sel.has(c)) sel.set(c,Math.max(1,parseInt(n.value)||1)); contador(); });
  contador(); preview();
}

function contador(){
  let n=0; sel.forEach(v=>n+=Math.max(1,parseInt(v)||1));
  document.getElementById('etq-cnt').textContent=sel.size+' producto(s) marcados · '+n+' etiqueta(s) a imprimir';
}

async function preview(){
  const box=document.getElementById('etq-prev'), warn=document.getElementById('etq-warn');
  const items=window.S&&S.items||[];
  const it=items.find(i=>sel.has(i.cod))||items[0];
  if(!it){ box.textContent='Sin productos para mostrar.'; warn.textContent=''; return; }
  try{
    const res=await construir([it]);
    if(!res.labels.length){ box.textContent='Este código no se puede codificar en Code 128.'; warn.textContent=''; return; }
    const pxW=res.g.L*3.7795;
    const z=Math.max(1,Math.min(6,290/pxW));
    box.innerHTML='<div class="in" style="zoom:'+r2(z)+'">'+res.labels[0]+'</div>'
      +'<div style="font-size:11px;color:#777;margin-top:6px">Etiqueta de '+res.g.L+' × '+res.g.H+' mm — ejemplo: '+esc(it.cod)+'</div>';
    warn.textContent=res.minMod<0.2?'⚠ Código largo para este tamaño: barra fina de '+r2(res.minMod)+' mm, puede costar leerlo con el celular. Aumentá el largo o usá una cinta más ancha.':'';
  }catch(e){
    box.textContent='No se pudo cargar la librería de códigos de barras (¿sin conexión?).'; warn.textContent='';
  }
}

function abrir(){
  if(!window.S||!S.items){ alert('Abrí primero la pestaña Stock → Catálogo.'); return; }
  construirDOM(); sync();
  document.getElementById('etq-ov').classList.add('open');
  renderLista();
}
function cerrar(){ const o=document.getElementById('etq-ov'); if(o) o.classList.remove('open'); }

function inyectarBoton(){
  if(document.getElementById('etq-btn')) return;
  const tb=document.querySelector('#sv-catalogo .toolbar'); if(!tb) return;
  const b=document.createElement('button'); b.id='etq-btn'; b.className='btn-sec';
  b.innerHTML='<i class="ti ti-barcode"></i> Etiquetas'; b.onclick=abrir;
  const ref=Array.prototype.find.call(tb.children,c=>/Carga masiva/.test(c.textContent));
  tb.insertBefore(b,ref||null);
}

window.etqAbrir=abrir;
// API para pruebas / futuro uso
window.etqInternals={construir:construir,docHTML:docHTML,cfg:()=>cfg};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inyectarBoton); else inyectarBoton();
})();
