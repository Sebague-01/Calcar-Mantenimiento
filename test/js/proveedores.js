// ══════════════════════════════════════
// PROVEEDORES
// ══════════════════════════════════════
async function loadProveedores(){
  const {data,error}=await sb.from('proveedores').select('*').order('empresa');
  if(error){dbErr(error,'cargar proveedores');return;}
  S.prov=data.map(r=>({id:r.id,emp:r.empresa,rut:r.rut,rub:r.rubro,con:r.contacto,tel:r.telefono}));
  renderProv(S.prov);
}

async function saveProv(){
  const emp=v('pv-emp').trim(); if(!emp){alert('Ingresá el nombre.');return;}
  const row={empresa:emp,rut:v('pv-rut'),rubro:v('pv-rub'),contacto:v('pv-con'),telefono:v('pv-tel')};
  loading(true);
  const {error}=await sb.from('proveedores').insert(row);
  loading(false);
  if(error){dbErr(error,'guardar proveedor');return;}
  closeModal('m-proveedor'); clr(['pv-emp','pv-rut','pv-con','pv-tel']);
  await loadProveedores();
}

function renderProv(arr){
  const tb=g('tb-prov');
  if(!arr.length){tb.innerHTML='<tr><td colspan="5"><div class="empty"><i class="ti ti-building-factory"></i>Sin proveedores.</div></td></tr>';return;}
  tb.innerHTML=arr.map(p=>'<tr><td>'+p.emp+'</td><td><span class="mono">'+(p.rut||'—')+'</span></td><td><span class="badge b-gray">'+p.rub+'</span></td><td>'+(p.con||'—')+'</td><td>'+(p.tel||'—')+'</td></tr>').join('');
}

function filterProv(){
  const q=g('s-prov').value.toLowerCase();
  renderProv(S.prov.filter(p=>!q||p.emp.toLowerCase().includes(q)));
}

// Usadas por el modal de OTE para el combo de proveedor (dependen de S.prov)
function fillProvSel(){
  const s=g('ote-prov');
  s.innerHTML='<option value="">— seleccioná —</option>';
  S.prov.forEach(p=>{const o=document.createElement('option');o.value=p.emp;o.textContent=p.emp;o.dataset.rut=p.rut||'';s.appendChild(o);});
}

function autoRutProv(){
  const sel=g('ote-prov');
  const opt=sel.options[sel.selectedIndex];
  g('ote-rut-prov').value=opt?opt.dataset.rut||'':'';
}
