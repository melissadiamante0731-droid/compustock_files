"use strict";

const $ = id => document.getElementById(id);
const money = value => Number(value || 0).toLocaleString("en-PH", {style:"currency",currency:"PHP"});
const today = () => new Date().toISOString().slice(0,10);
const loadData = (key, fallback) => { try { const saved=localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; } catch { return fallback; } };
const defaults = [
 {id:1,name:"Ryzen 5 5600",sku:"CPU-001",brand:"AMD",category:"CPU",cost:5500,price:6495,stock:12,reorder:3,supplierId:""},
 {id:2,name:"MSI RTX 4060",sku:"GPU-001",brand:"MSI",category:"GPU",cost:17500,price:19495,stock:4,reorder:5,supplierId:""},
 {id:3,name:"Kingston Fury 16GB",sku:"RAM-001",brand:"Kingston",category:"RAM",cost:1600,price:1895,stock:18,reorder:5,supplierId:""},
 {id:4,name:"Samsung 990 EVO 1TB",sku:"SSD-001",brand:"Samsung",category:"SSD/HDD",cost:4200,price:4795,stock:9,reorder:3,supplierId:""},
 {id:5,name:"Corsair CV650",sku:"PSU-001",brand:"Corsair",category:"PSU",cost:2500,price:2995,stock:14,reorder:4,supplierId:""},
 {id:6,name:"Logitech G102",sku:"ACC-001",brand:"Logitech",category:"Accessories",cost:850,price:1095,stock:25,reorder:5,supplierId:""},
 {id:7,name:"AOC 24G2",sku:"MON-001",brand:"AOC",category:"Monitor",cost:6500,price:7495,stock:7,reorder:2,supplierId:""},
 {id:8,name:"MSI B550M PRO",sku:"MB-001",brand:"MSI",category:"Motherboard",cost:4200,price:4895,stock:45,reorder:5,supplierId:""}
];
let products = loadData("compustock_products", defaults);
let suppliers = loadData("compustock_suppliers", []);
let movements = loadData("compustock_movements", []);
let sales = loadData("compustock_sales", []);
let priceHistory = loadData("compustock_price_history", []);
let activity = loadData("compustock_activity", []);
let cart = [];
let currentUser = loadData("compustock_demo_user", {username:"Admin",role:"Admin"});
let reportRange = {from:"",to:""};

function saveAll(){
  const entries = {compustock_products:products,compustock_suppliers:suppliers,compustock_movements:movements,compustock_sales:sales,compustock_price_history:priceHistory,compustock_activity:activity,compustock_demo_user:currentUser};
  Object.entries(entries).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));
}
function esc(v){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function notify(message){const n=$("notice");n.textContent=message;n.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>n.classList.remove("show"),3000);}
function logAction(action,details=""){activity.unshift({date:new Date().toLocaleString(),user:currentUser.username,role:currentUser.role,action,details});activity=activity.slice(0,500);saveAll();}
function canManage(){return currentUser.role==="Admin"||currentUser.role==="Owner";}
function showPage(name){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===name));
 document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===name));
 const titles={dashboard:"Dashboard",products:"Products",suppliers:"Suppliers",inventory:"Inventory",pos:"Point of Sale",pricing:"Pricing",reports:"Reports",activity:"Activity Logs"};
 $("page-title").textContent=titles[name]||"Dashboard";
 const renderers={dashboard:renderDashboard,products:renderProducts,suppliers:renderSuppliers,inventory:renderMovements,pos:renderPOS,pricing:renderPricing,reports:renderReports,activity:renderActivity};
 if(renderers[name])renderers[name]();
}
document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",()=>showPage(a.dataset.page)));
$("global-search").addEventListener("input",e=>{$("product-search").value=e.target.value;showPage("products");renderProducts();});
function openModal(id){$(id).classList.add("show");}
function closeModal(id){$(id).classList.remove("show");}
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("show");}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal.show").forEach(m=>m.classList.remove("show"));});

function fillSupplierSelect(selectId,selected=""){
 const select=$(selectId);if(!select)return;
 select.innerHTML='<option value="">'+(selectId==="product-supplier"?"No supplier selected":"Select supplier")+'</option>'+suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 select.value=String(selected||"");
}
function fillProductSelect(selectId,selected=""){
 const select=$(selectId);if(!select)return;
 select.innerHTML=products.map(p=>`<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join("");
 if(selected!=="")select.value=String(selected);
}
function renderAll(){renderDashboard();renderProducts();renderSuppliers();renderMovements();renderPricing();renderPOS();renderReports();renderActivity();}

/* Products */
function openProductForm(id=""){
 if(!canManage()){notify("Only Admin or Owner can manage products.");return;}
 $("product-form").reset();$("product-id").value=id;$("product-form-title").textContent=id?"Edit Product":"Add Product";
 fillSupplierSelect("product-supplier");
 if(id!==""){const p=products.find(x=>String(x.id)===String(id));if(!p)return;
  $("product-name").value=p.name;$("product-sku").value=p.sku;$("product-brand").value=p.brand;$("product-category-form").value=p.category;
  $("product-cost").value=p.cost;$("product-price").value=p.price;$("product-stock").value=p.stock;$("product-reorder").value=p.reorder;$("product-supplier").value=String(p.supplierId||"");
 }
 openModal("product-modal");
}
$("product-form").addEventListener("submit",e=>{
 e.preventDefault();if(!canManage()){notify("Permission denied.");return;}
 const id=$("product-id").value;
 const data={name:$("product-name").value.trim(),sku:$("product-sku").value.trim(),brand:$("product-brand").value.trim(),category:$("product-category-form").value,cost:Number($("product-cost").value),price:Number($("product-price").value),stock:Number($("product-stock").value),reorder:Number($("product-reorder").value),supplierId:$("product-supplier").value};
 if(products.some(p=>p.sku.toLowerCase()===data.sku.toLowerCase()&&String(p.id)!==id)){alert("SKU already exists. Use a unique SKU.");return;}
 if([data.cost,data.price,data.stock,data.reorder].some(n=>!Number.isFinite(n)||n<0)||!Number.isInteger(data.stock)||!Number.isInteger(data.reorder)){alert("Enter valid non-negative costs/prices and whole-number stock values.");return;}
 if(id){const i=products.findIndex(p=>String(p.id)===id);if(i<0)return;products[i]={...products[i],...data};}
 else {const newId=Date.now();products.push({id:newId,...data});if(data.stock>0)movements.unshift({date:new Date().toLocaleString(),iso:today(),productId:newId,product:data.name,type:"Initial Stock",qty:data.stock,before:0,after:data.stock,notes:"Initial product setup"});}
 saveAll();logAction(id?"Updated product":"Added product",`${data.name} (${data.sku})`);closeModal("product-modal");renderAll();notify("Product saved successfully.");
});
function renderProducts(){
 const search=($("product-search").value||"").toLowerCase().trim(),cat=$("category-filter").value;
 const list=products.filter(p=>`${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(search)&&(!cat||p.category===cat));
 $("product-table-body").innerHTML=list.length?list.map(p=>`<tr><td>${esc(p.sku)}</td><td><strong>${esc(p.name)}</strong><br><small>${esc(p.brand)}</small></td><td>${esc(p.category)}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td><td><span class="badge ${p.stock<=p.reorder?"low":""}">${p.stock}</span></td><td><div class="actions"><button class="secondary" onclick="openProductForm('${p.id}')">Edit</button><button class="danger" onclick="deleteProduct('${p.id}')">Delete</button></div></td></tr>`).join(""):'<tr><td colspan="7" class="empty">No products found.</td></tr>';
}
function deleteProduct(id){
 if(!canManage()){notify("Only Admin or Owner can delete products.");return;}
 const p=products.find(x=>String(x.id)===String(id));if(!p||!confirm(`Delete "${p.name}"?`))return;
 products=products.filter(x=>String(x.id)!==String(id));cart=cart.filter(x=>String(x.id)!==String(id));saveAll();logAction("Deleted product",p.name);renderAll();notify("Product deleted.");
}

/* Suppliers */
function openSupplierForm(id=""){
 if(!canManage()){notify("Only Admin or Owner can manage suppliers.");return;}
 $("supplier-form").reset();$("supplier-id").value=id;$("supplier-form-title").textContent=id?"Edit Supplier":"Add Supplier";
 if(id){const s=suppliers.find(x=>String(x.id)===String(id));if(!s)return;$("supplier-name").value=s.name;$("supplier-contact").value=s.contact;$("supplier-phone").value=s.phone;$("supplier-email").value=s.email;$("supplier-address").value=s.address;}
 openModal("supplier-modal");
}
$("supplier-form").addEventListener("submit",e=>{
 e.preventDefault();if(!canManage())return;
 const id=$("supplier-id").value,data={name:$("supplier-name").value.trim(),contact:$("supplier-contact").value.trim(),phone:$("supplier-phone").value.trim(),email:$("supplier-email").value.trim(),address:$("supplier-address").value.trim()};
 if(suppliers.some(s=>s.name.toLowerCase()===data.name.toLowerCase()&&String(s.id)!==id)){alert("A supplier with this name already exists.");return;}
 if(id){const i=suppliers.findIndex(s=>String(s.id)===id);if(i<0)return;suppliers[i]={...suppliers[i],...data};}else suppliers.push({id:Date.now(),...data});
 saveAll();logAction(id?"Updated supplier":"Added supplier",data.name);closeModal("supplier-modal");renderAll();notify("Supplier saved successfully.");
});
function renderSuppliers(){
 const q=($("supplier-search").value||"").toLowerCase().trim(),list=suppliers.filter(s=>`${s.name} ${s.contact} ${s.phone} ${s.email} ${s.address}`.toLowerCase().includes(q));
 $("supplier-table-body").innerHTML=list.length?list.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.contact)}</td><td>${esc(s.phone)}</td><td>${esc(s.email)}</td><td>${esc(s.address)}</td><td><div class="actions"><button class="secondary" onclick="openSupplierForm('${s.id}')">Edit</button><button class="danger" onclick="deleteSupplier('${s.id}')">Delete</button></div></td></tr>`).join(""):'<tr><td colspan="6" class="empty">No suppliers yet. Click “Add Supplier” to create one.</td></tr>';
}
function deleteSupplier(id){
 if(!canManage()){notify("Only Admin or Owner can delete suppliers.");return;}
 const s=suppliers.find(x=>String(x.id)===String(id));if(!s||!confirm(`Delete supplier "${s.name}"?`))return;
 suppliers=suppliers.filter(x=>String(x.id)!==String(id));products.forEach(p=>{if(String(p.supplierId)===String(id))p.supplierId="";});saveAll();logAction("Deleted supplier",s.name);renderAll();notify("Supplier deleted.");
}

/* Inventory */
function openMovementForm(){
 if(!canManage()){notify("Only Admin or Owner can record stock movements in this demo.");return;}
 if(!products.length){alert("Add a product first.");return;}
 fillProductSelect("movement-product");$("movement-form").reset();$("movement-quantity-label").textContent="Quantity";
 $("movement-type").onchange=()=>{$("movement-quantity-label").textContent=$("movement-type").value==="Adjustment"?"New total stock quantity":"Quantity";$("movement-quantity").min=$("movement-type").value==="Adjustment"?"0":"1";};
 openModal("movement-modal");
}
$("movement-form").addEventListener("submit",e=>{
 e.preventDefault();if(!canManage())return;
 const p=products.find(x=>String(x.id)===$("movement-product").value),type=$("movement-type").value,qty=Number($("movement-quantity").value),notes=$("movement-notes").value.trim();
 if(!p||!Number.isInteger(qty)||qty<0||(type!=="Adjustment"&&qty<1)){alert("Enter a valid whole-number quantity.");return;}
 const before=p.stock;let after=before,delta=qty;
 if(type==="Stock In")after=before+qty;
 else if(type==="Stock Out"){if(qty>before){alert("Not enough stock available.");return;}after=before-qty;delta=-qty;}
 else {after=qty;delta=after-before;}
 p.stock=after;movements.unshift({date:new Date().toLocaleString(),iso:today(),productId:p.id,product:p.name,type,qty:Math.abs(delta),before,after,notes});
 saveAll();logAction(type==="Adjustment"?"Adjusted stock":`Recorded ${type.toLowerCase()}`,`${p.name}: ${before} → ${after}${notes?" — "+notes:""}`);closeModal("movement-modal");renderAll();notify("Stock movement recorded.");
});
function inDateRange(record,from,to){const d=record.iso||(record.date?new Date(record.date).toISOString().slice(0,10):"");return(!from||d>=from)&&(!to||d<=to);}
function renderMovements(){
 const from=$("movement-from").value,to=$("movement-to").value,type=$("movement-filter").value;
 const list=movements.filter(m=>inDateRange(m,from,to)&&(!type||m.type===type));
 $("movement-table").innerHTML=list.length?list.map(m=>`<tr><td>${esc(m.date)}</td><td>${esc(m.product)}</td><td>${esc(m.type)}</td><td>${m.qty}</td><td>${m.before}</td><td>${m.after}</td><td>${esc(m.notes||"—")}</td></tr>`).join(""):'<tr><td colspan="7" class="empty">No stock movements recorded for this filter.</td></tr>';
}

/* Point of sale and receipts */
function addToCart(id){
 const p=products.find(x=>String(x.id)===String(id));if(!p||p.stock<1){alert("This product is out of stock.");return;}
 const item=cart.find(x=>String(x.id)===String(id));
 if(item){if(item.qty>=p.stock){alert("Quantity exceeds available stock.");return;}item.qty++;}else cart.push({id:p.id,qty:1});
 renderPOS();
}
function changeCartQty(id,change){
 const item=cart.find(x=>String(x.id)===String(id)),p=products.find(x=>String(x.id)===String(id));if(!item||!p)return;
 const q=item.qty+change;if(q<1)cart=cart.filter(x=>String(x.id)!==String(id));else if(q>p.stock)alert("Quantity exceeds available stock.");else item.qty=q;renderPOS();
}
function renderPOS(){
 const q=($("pos-search").value||"").toLowerCase().trim(),list=products.filter(p=>`${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(q));
 $("pos-products").innerHTML=list.length?list.map(p=>`<div class="product-card"><h3>${esc(p.name)}</h3><p>${esc(p.brand)} · ${esc(p.category)} · SKU ${esc(p.sku)}</p><p>Stock available: ${p.stock}</p><div class="price">${money(p.price)}</div><button class="primary" style="margin-top:12px" onclick="addToCart('${p.id}')" ${p.stock<1?"disabled":""}>Add to Cart</button></div>`).join(""):'<p class="empty">No matching products.</p>';
 const total=cart.reduce((sum,i)=>{const p=products.find(x=>String(x.id)===String(i.id));return sum+(p?p.price*i.qty:0);},0);
 $("cart-items").innerHTML=cart.length?cart.map(i=>{const p=products.find(x=>String(x.id)===String(i.id));if(!p)return"";return `<div class="cart-row"><div><strong>${esc(p.name)}</strong><small>${money(p.price)} each</small></div><div class="actions"><button class="secondary" onclick="changeCartQty('${p.id}',-1)">−</button><span>${i.qty}</span><button class="secondary" onclick="changeCartQty('${p.id}',1)">+</button></div></div>`;}).join(""):'<p class="muted">Your cart is empty.</p>';
 $("cart-total").textContent=money(total);
}
function checkout(){
 if(!cart.length){alert("Your cart is empty.");return;}
 for(const i of cart){const p=products.find(x=>String(x.id)===String(i.id));if(!p||i.qty>p.stock){alert("Stock changed. Please review your cart.");renderPOS();return;}}
 const items=cart.map(i=>{const p=products.find(x=>String(x.id)===String(i.id));return {productId:p.id,name:p.name,sku:p.sku,qty:i.qty,price:p.price,cost:p.cost,lineTotal:p.price*i.qty};});
 const total=items.reduce((s,i)=>s+i.lineTotal,0),profit=items.reduce((s,i)=>s+(i.price-i.cost)*i.qty,0);
 const receipt={id:"CS-"+Date.now(),date:new Date().toLocaleString(),iso:today(),items,total,profit,user:currentUser.username};
 items.forEach(i=>{const p=products.find(x=>String(x.id)===String(i.productId)),before=p.stock;p.stock-=i.qty;movements.unshift({date:new Date().toLocaleString(),iso:today(),productId:p.id,product:p.name,type:"Sale",qty:i.qty,before,after:p.stock,notes:receipt.id});});
 sales.unshift(receipt);cart=[];saveAll();logAction("Completed sale",`${receipt.id} — ${money(total)}`);renderAll();showReceipt(receipt);notify("Sale completed.");
}
function showReceipt(r){
 $("receipt-content").innerHTML=`<div class="print-area"><h2>KENJIJAYE COMPUTER AND INTERNET CAFE</h2><h3>Sales Receipt</h3><p><strong>Receipt:</strong> ${esc(r.id)}<br><strong>Date:</strong> ${esc(r.date)}<br><strong>Cashier:</strong> ${esc(r.user||"")}</p><div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${r.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.lineTotal??i.price*i.qty)}</td></tr>`).join("")}</tbody></table></div><h2 class="receipt-total">TOTAL: ${money(r.total)}</h2><p class="muted">Thank you for your purchase!</p></div>`;
 openModal("receipt-modal");
}
function printReceipt(){const content=$("receipt-content").innerHTML,old=document.body.innerHTML;document.body.innerHTML=`<div class="print-area">${content}</div>`;window.print();document.body.innerHTML=old;location.reload();}

/* Pricing and supplier price history */
function renderPricing(){
 fillProductSelect("calc-product");fillProductSelect("history-product");fillSupplierSelect("history-supplier");
 if(!$("history-date").value)$("history-date").value=today();
 $("pricing-table").innerHTML=products.length?products.map(p=>{const s=suppliers.find(x=>String(x.id)===String(p.supplierId));const latest=priceHistory.filter(h=>String(h.productId)===String(p.id)).sort((a,b)=>(b.iso||"").localeCompare(a.iso||""))[0];return `<tr><td>${esc(p.name)}</td><td>${esc(s?s.name:"—")}</td><td>${latest?money(latest.cost):"—"}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${money(p.price-p.cost)}</td><td><button class="secondary" onclick="editPrice('${p.id}')">Edit Price</button></td></tr>`;}).join(""):'<tr><td colspan="7" class="empty">No products available.</td></tr>';
 $("price-history-table").innerHTML=priceHistory.length?priceHistory.slice().sort((a,b)=>(b.iso||"").localeCompare(a.iso||"")).map(h=>{const p=products.find(x=>String(x.id)===String(h.productId)),s=suppliers.find(x=>String(x.id)===String(h.supplierId));return `<tr><td>${esc(h.iso||h.date)}</td><td>${esc(p?p.name:h.productName||"Deleted product")}</td><td>${esc(s?s.name:"Deleted supplier")}</td><td>${money(h.cost)}</td><td>${esc(h.notes||"—")}</td></tr>`;}).join(""):'<tr><td colspan="5" class="empty">No supplier price history recorded.</td></tr>';
 updateCalculator();
}
function updateCalculator(){
 const id=$("calc-product").value,p=products.find(x=>String(x.id)===String(id));
 if(p&&document.activeElement!==$("calc-cost"))$("calc-cost").value=p.cost;
 const cost=Math.max(0,Number($("calc-cost").value)||0),markup=Math.max(0,Number($("calc-markup").value)||0),srp=cost*(1+markup/100);
 $("calc-srp").textContent=money(srp);$("calc-profit").textContent=`Estimated gross profit: ${money(srp-cost)}`;
}
$("apply-srp").addEventListener("click",()=>{
 if(!canManage()){notify("Only Admin or Owner can change prices.");return;}
 const p=products.find(x=>String(x.id)===String($("calc-product").value));if(!p){notify("Add a product first.");return;}
 const srp=Math.round((Number($("calc-cost").value||0)*(1+Number($("calc-markup").value||0)/100))*100)/100;
 p.cost=Number($("calc-cost").value)||0;p.price=srp;saveAll();logAction("Applied SRP",`${p.name}: ${money(srp)}`);renderAll();notify("Suggested retail price applied.");
});
function editPrice(id){
 if(!canManage()){notify("Only Admin or Owner can edit prices.");return;}
 const p=products.find(x=>String(x.id)===String(id));if(!p)return;
 const input=prompt(`New selling price for ${p.name} (current ${p.price}):`,p.price);if(input===null)return;
 const price=Number(input);if(!Number.isFinite(price)||price<0){alert("Enter a valid non-negative price.");return;}
 p.price=price;saveAll();logAction("Edited selling price",`${p.name}: ${money(price)}`);renderAll();notify("Selling price updated.");
}
$("price-history-form").addEventListener("submit",e=>{
 e.preventDefault();if(!canManage()){notify("Only Admin or Owner can record supplier prices.");return;}
 const productId=$("history-product").value,supplierId=$("history-supplier").value,cost=Number($("history-cost").value),iso=$("history-date").value,notes=$("history-notes").value.trim();
 if(!productId||!supplierId||!Number.isFinite(cost)||cost<0||!iso){alert("Complete all required supplier-price fields.");return;}
 const p=products.find(x=>String(x.id)===String(productId));if(!p)return;
 priceHistory.unshift({id:Date.now(),productId:Number(productId),supplierId:Number(supplierId),cost,iso,date:iso,notes});
 p.cost=cost;p.supplierId=String(supplierId);$("history-cost").value="";$("history-notes").value="";
 saveAll();logAction("Recorded supplier price",`${p.name}: ${money(cost)}`);renderAll();notify("Supplier price history saved and product cost updated.");
});

/* Dashboard, reports, activity, exports */
function renderDashboard(){
 $("total-products").textContent=products.length;$("total-stock").textContent=products.reduce((s,p)=>s+Number(p.stock||0),0);$("total-sales").textContent=money(sales.reduce((s,x)=>s+x.total,0));$("low-stock-count").textContent=products.filter(p=>p.stock<=p.reorder).length;
 $("inventory-overview").innerHTML=products.length?products.map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${p.stock}</td><td><span class="badge ${p.stock<=p.reorder?"low":""}">${p.stock<=p.reorder?"Low Stock":"In Stock"}</span></td></tr>`).join(""):'<tr><td colspan="5" class="empty">No products yet.</td></tr>';
 $("recent-sales").innerHTML=sales.slice(0,5).map(s=>`<tr><td>${esc(s.id)}</td><td>${esc(s.date)}</td><td>${s.items.reduce((n,i)=>n+i.qty,0)} item(s)</td><td>${money(s.total)}</td><td><button class="secondary" onclick="reprintReceipt('${s.id}')">Receipt</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">No sales yet.</td></tr>';
}
function reprintReceipt(id){const r=sales.find(s=>s.id===id);if(r)showReceipt(r);}
function filteredSales(){return sales.filter(s=>inDateRange(s,reportRange.from,reportRange.to));}
function renderReports(){
 const list=filteredSales();$("report-count").textContent=list.length;$("report-total").textContent=money(list.reduce((s,r)=>s+r.total,0));$("report-profit").textContent=money(list.reduce((s,r)=>s+r.profit,0));
 $("report-sales").innerHTML=list.length?list.map(s=>`<tr><td>${esc(s.id)}</td><td>${esc(s.date)}</td><td>${s.items.map(i=>`${esc(i.name)} ×${i.qty}`).join(", ")}</td><td>${money(s.total)}</td><td>${money(s.profit)}</td><td><button class="secondary" onclick="reprintReceipt('${s.id}')">Receipt</button></td></tr>`).join(""):'<tr><td colspan="6" class="empty">No sales found for this date range.</td></tr>';
}
$("apply-report-filter").addEventListener("click",()=>{reportRange={from:$("report-from").value,to:$("report-to").value};if(reportRange.from&&reportRange.to&&reportRange.from>reportRange.to){alert("The From date must be before the To date.");return;}renderReports();});
$("clear-report-filter").addEventListener("click",()=>{$("report-from").value="";$("report-to").value="";reportRange={from:"",to:""};renderReports();});
function renderActivity(){
 $("activity-table").innerHTML=activity.length?activity.map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.user)}</td><td>${esc(a.role)}</td><td>${esc(a.action)}</td><td>${esc(a.details)}</td></tr>`).join(""):'<tr><td colspan="5" class="empty">No activity recorded yet.</td></tr>';
}
function exportCSV(type){
 let rows=[],filename="";
 if(type==="inventory"){rows=[["SKU","Product","Brand","Category","Supplier","Acquisition Cost","Selling Price","Stock","Reorder Level"],...products.map(p=>[p.sku,p.name,p.brand,p.category,(suppliers.find(s=>String(s.id)===String(p.supplierId))||{}).name||"",p.cost,p.price,p.stock,p.reorder])];filename="compustock-inventory.csv";}
 else if(type==="sales"){rows=[["Receipt No.","Date","Items","Total","Estimated Gross Profit"],...filteredSales().map(s=>[s.id,s.date,s.items.map(i=>`${i.name} x${i.qty}`).join("; "),s.total,s.profit])];filename="compustock-sales.csv";}
 else if(type==="movements"){rows=[["Date","Product","Type","Quantity","Stock Before","Stock After","Notes"],...movements.map(m=>[m.date,m.product,m.type,m.qty,m.before,m.after,m.notes||""])];filename="compustock-stock-movements.csv";}
 else {rows=[["Date","User","Role","Action","Details"],...activity.map(a=>[a.date,a.user,a.role,a.action,a.details])];filename="compustock-activity-logs.csv";}
 const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);logAction("Exported CSV",filename);
}

/* Demo login and role-based UI. This is not production authentication. */
function updateUserUI(){
 $("user-display").textContent=currentUser.username;$("role-display").textContent=currentUser.role;$("user-avatar").textContent=(currentUser.username[0]||"U").toUpperCase();
 document.querySelectorAll(".nav-link").forEach(a=>{const restricted=["products","suppliers","inventory","pricing"].includes(a.dataset.page);a.style.display=(!restricted||canManage())?"block":"none";});
}
$("login-form").addEventListener("submit",e=>{
 e.preventDefault();const username=$("login-user").value.trim(),password=$("login-password").value,role=$("login-role").value;
 if(!username||!password){alert("Enter a username and password.");return;}
 currentUser={username,role};saveAll();$("login-screen").classList.add("hidden");$("app").style.display="flex";updateUserUI();logAction("Signed in","Demo sign-in");renderAll();notify(`Signed in as ${role}.`);
});
$("logout-button").addEventListener("click",()=>{$("login-screen").classList.remove("hidden");$("app").style.display="none";});
function initialize(){
 if(!Array.isArray(products))products=defaults;if(!Array.isArray(suppliers))suppliers=[];if(!Array.isArray(movements))movements=[];if(!Array.isArray(sales))sales=[];if(!Array.isArray(priceHistory))priceHistory=[];if(!Array.isArray(activity))activity=[];
 $("app").style.display="none";$("login-screen").classList.remove("hidden");updateUserUI();renderAll();
}
initialize();
