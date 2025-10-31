(function(){const t=new Date().toISOString().split('T')[0];document.querySelectorAll('input[type="date"]').forEach(e=>e.min=t)})();
function openWhatsApp(p,m){const u=`https://wa.me/${encodeURIComponent(p.replace(/\D/g,''))}?text=${encodeURIComponent(m)}`;window.open(u,'_blank')}
function copyText(id){const el=document.getElementById(id);if(!el)return;const txt=(el.innerText||el.textContent).trim();navigator.clipboard.writeText(txt).then(()=>alert('Kopyalandı: '+txt)).catch(()=>alert('Kopyalama başarısız. Lütfen elle kopyalayın.'))}
