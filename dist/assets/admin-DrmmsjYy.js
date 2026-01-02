import"./modulepreload-polyfill-B5Qt9EMX.js";const _="modulepreload",j=function(e){return"/"+e},L={},I=function(t,n,o){let i=Promise.resolve();if(n&&n.length>0){document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),l=(r==null?void 0:r.nonce)||(r==null?void 0:r.getAttribute("nonce"));i=Promise.allSettled(n.map(s=>{if(s=j(s),s in L)return;L[s]=!0;const m=s.endsWith(".css"),u=m?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${s}"]${u}`))return;const a=document.createElement("link");if(a.rel=m?"stylesheet":_,m||(a.as="script"),a.crossOrigin="",a.href=s,l&&a.setAttribute("nonce",l),document.head.appendChild(a),m)return new Promise((w,p)=>{a.addEventListener("load",w),a.addEventListener("error",()=>p(new Error(`Unable to preload CSS for ${s}`)))})}))}function c(r){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=r,window.dispatchEvent(l),!l.defaultPrevented)throw r}return i.then(r=>{for(const l of r||[])l.status==="rejected"&&c(l.reason);return t().catch(c)})},x="atharva_phatangare",P="atharva@1408";let E=[],h=[],b=[],y=[],O=!1;const F={apiKey:"AIzaSyDLnZu7F42nu1UnqHkyWzClB5AX25Jds0o",authDomain:"e-book-4f4f8.firebaseapp.com",databaseURL:"https://e-book-4f4f8-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"e-book-4f4f8",storageBucket:"e-book-4f4f8.firebasestorage.app",messagingSenderId:"1052383218826",appId:"1:1052383218826:web:7c2e30520bf58177773173",measurementId:"G-5X14495FLX"};async function H(){try{const{initializeApp:e}=await I(async()=>{const{initializeApp:a}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");return{initializeApp:a}},[]),{getDatabase:t,ref:n,get:o,push:i,set:c,update:r,remove:l,onValue:s}=await I(async()=>{const{getDatabase:a,ref:w,get:p,push:g,set:k,update:T,remove:U,onValue:M}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");return{getDatabase:a,ref:w,get:p,push:g,set:k,update:T,remove:U,onValue:M}},[]),m=e(F),u=t(m);window.firebaseDB=u,window.firebaseRef=n,window.firebaseGet=o,window.firebasePush=i,window.firebaseSet=c,window.firebaseUpdate=r,window.firebaseRemove=l,window.firebaseOnValue=s,O=!0,s(n(u,"book-meta"),a=>{if(a.exists()){const w=a.val();E=Object.entries(w).map(([p,g])=>({id:p,...g}))}else E=[];A()}),s(n(u,"pending-users"),a=>{if(a.exists()){const w=a.val();h=Object.entries(w).map(([p,g])=>({id:p,...g})).filter(p=>p.status==="pending")}else h=[];ee()}),s(n(u,"approved-users"),a=>{if(a.exists()){const w=a.val();b=Object.entries(w).map(([p,g])=>({id:p,...g}))}else b=[];y=[...b],R()}),K(),s(n(u,"settings/emailjs"),a=>{if(a.exists()){const w=a.val(),p=document.getElementById("emailjs-service-id"),g=document.getElementById("emailjs-template-id"),k=document.getElementById("emailjs-public-key");p&&(p.value=w.serviceId||""),g&&(g.value=w.templateId||""),k&&(k.value=w.publicKey||"")}})}catch(e){console.error("Firebase init error:",e)}}function K(){sessionStorage.getItem("shelf_admin")==="true"&&S()}function N(e){e.preventDefault();const t=document.getElementById("username").value,n=document.getElementById("password").value,o=document.getElementById("login-error");t===x&&n===P?(sessionStorage.setItem("shelf_admin","true"),S(),document.getElementById("username").value="",document.getElementById("password").value="",o.textContent=""):o.textContent="Invalid username or password"}function J(){sessionStorage.removeItem("shelf_admin"),z()}function q(e){document.querySelectorAll(".admin-tab").forEach(o=>o.classList.remove("active")),document.querySelectorAll(".admin-tab-content").forEach(o=>o.classList.remove("active"));const t=document.getElementById(`tab-${e}`),n=document.getElementById(`admin-tab-${e}`);t&&t.classList.add("active"),n&&n.classList.add("active")}async function S(){document.getElementById("admin-login").classList.add("hidden"),document.getElementById("admin-panel").classList.remove("hidden"),A(),await Z();const e=document.getElementById("allow-desktops-toggle");e&&(e.checked=Y())}function z(){document.getElementById("admin-login").classList.remove("hidden"),document.getElementById("admin-panel").classList.add("hidden")}async function V(e){e.preventDefault();const t=document.getElementById("book-title").value.trim(),n=document.getElementById("book-author").value.trim(),o=document.getElementById("book-pages").value.trim(),i=document.getElementById("book-description").value.trim(),c=document.getElementById("book-cover"),r=document.getElementById("book-file");if(!t||!n||!r.files[0]){d("Please fill in required fields");return}const l=r.files[0],s=c.files[0],m=10*1024*1024;if(l.size>m){d("File too large. Maximum 10MB for Firebase.");return}d("Uploading to cloud...");try{const u=await D(l);let a=null;s&&(a=await D(s)),await W(t,n,o,i,a,u,l.name),document.getElementById("upload-form").reset(),d("Book uploaded successfully!")}catch(u){console.error("Upload error:",u),d("Upload failed. Please try again.")}}function D(e){return new Promise((t,n)=>{const o=new FileReader;o.onload=()=>t(o.result),o.onerror=()=>n(o.error),o.readAsDataURL(e)})}async function W(e,t,n,o,i,c,r){const l=window.firebaseRef(window.firebaseDB,"book-meta"),s=window.firebasePush(l),m=s.key,u={title:e,author:t,pages:n,description:o,cover:i,fileName:r,createdAt:new Date().toISOString()};await window.firebaseSet(s,u);const a=window.firebaseRef(window.firebaseDB,`book-files/${m}`);await window.firebaseSet(a,c)}async function G(e){if(confirm("Are you sure you want to delete this book?"))try{await window.firebaseRemove(window.firebaseRef(window.firebaseDB,`book-meta/${e}`)),await window.firebaseRemove(window.firebaseRef(window.firebaseDB,`book-files/${e}`)),d("Book deleted")}catch(t){console.error("Delete error:",t),d("Failed to delete book")}}function A(){const e=document.getElementById("admin-books-list"),t=document.getElementById("admin-empty-state");if(!(!e||!t)){if(E.length===0){e.innerHTML="",e.classList.add("hidden"),t.classList.remove("hidden");return}t.classList.add("hidden"),e.classList.remove("hidden"),e.innerHTML=E.map(n=>`
    <div class="admin-book-item">
      <div class="admin-book-info">
        <div class="admin-book-thumb">
          ${n.cover?`<img src="${n.cover}" alt="${f(n.title)}">`:"📖"}
        </div>
        <div class="admin-book-details">
          <h4>${f(n.title)}</h4>
          <p>${f(n.author)}</p>
        </div>
      </div>
      <button class="btn btn-danger" onclick="deleteBook('${n.id}')">Delete</button>
    </div>
  `).join("")}}function f(e){const t=document.createElement("div");return t.textContent=e||"",t.innerHTML}async function X(){const e=document.getElementById("migrate-btn");e.disabled=!0,e.textContent="Checking...";try{const t=window.firebaseRef(window.firebaseDB,"books"),n=await window.firebaseGet(t);if(!n.exists()){d("No old books to migrate"),e.disabled=!1,e.textContent="Migrate",document.getElementById("migration-card").classList.add("hidden");return}const o=n.val(),i=Object.entries(o);e.textContent=`Migrating ${i.length}...`,d(`Migrating ${i.length} book(s)...`);let c=0,r=0;for(const[l,s]of i)try{const m={};m["book-meta/"+l]={title:s.title,author:s.author,description:s.description,cover:s.cover,fileName:s.fileName,createdAt:s.createdAt},m["book-files/"+l]=s.fileData,m["books/"+l]=null,await window.firebaseUpdate(window.firebaseRef(window.firebaseDB),m),c++}catch(m){console.error("Failed to migrate book "+l+":",m),r++}e.disabled=!1,e.textContent="Migrate",r===0?(d("Successfully migrated "+c+" book(s)!"),document.getElementById("migration-card").classList.add("hidden")):d("Migrated "+c+", failed "+r)}catch(t){console.error("Migration error:",t),d("Migration failed"),e.disabled=!1,e.textContent="Migrate"}}const B={ALLOW_DESKTOPS:"shelf_allow_desktops"};let v=!0;function Y(){return v}async function Z(){try{const e=window.firebaseRef(window.firebaseDB,"settings/allowDesktops"),t=await window.firebaseGet(e);t.exists()?v=t.val()===!0:v=!0,localStorage.setItem(B.ALLOW_DESKTOPS,v.toString())}catch(e){console.error("Error fetching desktop access setting:",e),v=localStorage.getItem(B.ALLOW_DESKTOPS)!=="false"}}async function Q(){const e=document.getElementById("allow-desktops-toggle"),t=e.checked;try{const n=window.firebaseRef(window.firebaseDB,"settings/allowDesktops");await window.firebaseSet(n,t),v=t,localStorage.setItem(B.ALLOW_DESKTOPS,t.toString()),d(t?"Desktop access enabled":"Desktop access disabled")}catch(n){console.error("Error updating desktop access:",n),e.checked=!t,d("Failed to update setting")}}function d(e){const t=document.getElementById("toast");t.textContent=e,t.classList.remove("hidden"),setTimeout(()=>{t.classList.add("hidden")},3e3)}function ee(){const e=document.getElementById("pending-users-list"),t=document.getElementById("pending-users-empty");if(!(!e||!t)){if(h.length===0){e.innerHTML="",e.classList.add("hidden"),t.classList.remove("hidden");return}t.classList.add("hidden"),e.classList.remove("hidden"),e.innerHTML=h.map(n=>`
    <div class="pending-user-card">
      <div class="pending-user-info">
        <div class="pending-user-header">
          <h4>${f(n.name)}</h4>
          <span class="pending-badge">Pending</span>
        </div>
        <div class="pending-user-details">
          <p><strong>Email:</strong> ${f(n.email||"N/A")}</p>
          <p><strong>Phone:</strong> ${f(n.phone||"N/A")}</p>
          <p><strong>College:</strong> ${f(n.college||"N/A")}</p>
          <p><strong>Division:</strong> ${f(n.division)}</p>
          <p><strong>Branch:</strong> ${f(n.branch)}</p>
          <p><strong>Year:</strong> ${f(n.year)}</p>
          <p><strong>Submitted:</strong> ${new Date(n.submittedAt).toLocaleDateString()}</p>
        </div>
      </div>
      <div class="pending-user-actions">
        <button class="btn btn-approve" onclick="approveUser('${n.id}')">
          <i class="fa-solid fa-check"></i> Approve
        </button>
        <button class="btn btn-reject" onclick="rejectUser('${n.id}')">
          <i class="fa-solid fa-xmark"></i> Reject
        </button>
      </div>
    </div>
  `).join("")}}function R(){const e=document.getElementById("approved-users-list"),t=document.getElementById("approved-users-empty");if(!(!e||!t)){if(y.length===0){e.innerHTML="",e.classList.add("hidden"),t.classList.remove("hidden");return}t.classList.add("hidden"),e.classList.remove("hidden"),e.innerHTML=y.map(n=>{var o,i;return`
    <div class="pending-user-card">
      <div class="pending-user-info">
        <div class="pending-user-header">
          <h4>${f(n.name)}</h4>
          <span class="pending-badge" style="background: #dcfce7; color: #166534;">Approved</span>
        </div>
        <div class="pending-user-details">
          <p><strong>Email:</strong> ${f(n.email||"N/A")}</p>
          <p><strong>Phone:</strong> ${f(n.phone||"N/A")}</p>
          <p><strong>College:</strong> ${f(n.college||"N/A")}</p>
          <p><strong>Approved:</strong> ${new Date(n.approvedAt).toLocaleDateString()}</p>
          <p><strong>User ID:</strong> <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${n.credentials?n.credentials.id:"N/A"}</code></p>
          <p><strong>Password:</strong> <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${n.credentials?n.credentials.password:"N/A"}</code></p>
        </div>
      </div>
      <div class="pending-user-actions">
        <button class="btn btn-approve" onclick="showCredentialsModal('${(o=n.credentials)==null?void 0:o.id}', '${(i=n.credentials)==null?void 0:i.password}', '${f(n.name)}', '${f(n.email)}')" style="flex: 1;">
          <i class="fa-solid fa-key"></i> Credentials
        </button>
        <button class="btn btn-reject" onclick="revokeUser('${n.id}')" style="flex: 1;">
          <i class="fa-solid fa-trash"></i> Revoke
        </button>
      </div>
    </div>
  `}).join("")}}function te(){const e=document.getElementById("user-search-input").value.toLowerCase().trim();e?y=b.filter(t=>t.name&&t.name.toLowerCase().includes(e)||t.email&&t.email.toLowerCase().includes(e)):y=[...b],R()}function ne(e,t="pending"){const o=(t==="pending"?h:b).find(i=>i.id===e);if(o&&o.idCard){const i=document.createElement("div");i.className="id-card-modal",i.innerHTML=`
      <div class="id-card-modal-content">
        <button class="id-card-close" onclick="this.parentElement.parentElement.remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img src="${o.idCard}" alt="ID Card" />
        <p>${f(o.name)}</p>
      </div>
    `,document.body.appendChild(i),i.addEventListener("click",c=>{c.target===i&&i.remove()})}}function ie(e){const t=["cool","smart","fast","bright","happy","kind","brave","calm","keen","bold"],n=t[Math.floor(Math.random()*t.length)],o=e.toLowerCase().replace(/[^a-z]/g,"").substring(0,6),i=Math.floor(100+Math.random()*899);return`${n}_${o}${i}`}function oe(e=12){const t="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";let n="";for(let o=0,i=t.length;o<e;++o)n+=t.charAt(Math.floor(Math.random()*i));return n}function C(e,t,n,o){const i=document.createElement("div");i.className="id-card-modal",i.innerHTML=`
    <div class="id-card-modal-content credential-modal">
      <button class="id-card-close" onclick="this.closest('.id-card-modal').remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="credential-header">
        <i class="fa-solid fa-key"></i>
        <h3>User Credentials Generated</h3>
      </div>
      <p class="credential-subtitle">Credentials for <strong>${f(n)}</strong></p>
      
      <div class="credential-field">
        <label>User ID</label>
        <div class="credential-value-wrap">
          <span class="credential-value">${e}</span>
          <button class="copy-btn" onclick="copyToClipboard('${e}', this)">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>
      
      <div class="credential-field">
        <label>Password</label>
        <div class="credential-value-wrap">
          <span class="credential-value">${t}</span>
          <button class="copy-btn" onclick="copyToClipboard('${t}', this)">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>
      
      <div class="credential-actions">
        <button id="send-credentials-btn" class="btn btn-primary btn-full" onclick="sendCredentialsEmail('${e}', '${t}', '${f(n)}', '${f(o)}', this)">
          <i class="fa-solid fa-paper-plane"></i> Send Credentials
        </button>
      </div>
    </div>
  `,document.body.appendChild(i)}async function se(e,t,n,o,i){const c=i.innerHTML;i.disabled=!0,i.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Sending...';try{const r=window.firebaseRef(window.firebaseDB,"settings/emailjs"),l=await window.firebaseGet(r);if(!l.exists()){d("EmailJS credentials not found in RTDB"),i.disabled=!1,i.innerHTML=c;return}const s=l.val(),m=await fetch("https://api.emailjs.com/api/v1.0/email/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({service_id:s.serviceId,template_id:s.templateId,user_id:s.publicKey,template_params:{to_name:n,to_email:o,user_id:e,user_password:t}})});if(m.ok)d("Credentials sent to "+o),i.closest(".id-card-modal").remove();else{const u=await m.text();console.error("EmailJS error:",u),d("Failed to send email"),i.disabled=!1,i.innerHTML=c}}catch(r){console.error("Email error:",r),d("An error occurred while sending email"),i.disabled=!1,i.innerHTML=c}}window.sendCredentialsEmail=se;async function $(e,t){try{await navigator.clipboard.writeText(e);const n=t.innerHTML;t.innerHTML='<i class="fa-solid fa-check"></i>',t.classList.add("copied"),d("Copied to clipboard"),setTimeout(()=>{t.innerHTML=n,t.classList.remove("copied")},2e3)}catch(n){console.error("Failed to copy:",n),d("Failed to copy")}}window.copyToClipboard=$;async function ae(e){if(confirm("Approve this user registration?"))try{const t=h.find(n=>n.id===e);if(t){const n=ie(t.name),o=oe(12),i=t.email.toLowerCase().replace(/[.#$[\]]/g,"_"),c=window.firebaseRef(window.firebaseDB,"email-bindings/"+i);await window.firebaseSet(c,{deviceId:e,email:t.email,approvedAt:new Date().toISOString()});const r=window.firebaseRef(window.firebaseDB,"device-bindings/"+e);await window.firebaseSet(r,{email:t.email,name:t.name,approvedAt:new Date().toISOString()});const l=window.firebaseRef(window.firebaseDB,"approved-users/"+e);await window.firebaseSet(l,{name:t.name,email:t.email||"",phone:t.phone||"",college:t.college||"",submittedAt:t.submittedAt,approvedAt:new Date().toISOString(),deviceId:e,credentials:{id:n,password:o}});const s=window.firebaseRef(window.firebaseDB,"pending-users/"+e);await window.firebaseRemove(s),d("User approved successfully!"),C(n,o,t.name,t.email)}}catch(t){console.error("Error approving user:",t),d("Failed to approve user")}}async function re(e){if(confirm("Reject this user registration?"))try{const t=window.firebaseRef(window.firebaseDB,"pending-users/"+e);await window.firebaseUpdate(t,{status:"rejected"}),d("User registration rejected")}catch(t){console.error("Error rejecting user:",t),d("Failed to reject user")}}async function de(e){if(confirm("Revoke access for this user? This will also remove their device binding."))try{const t=b.find(n=>n.id===e);if(t){const n=t.email.toLowerCase().replace(/[.#$[\]]/g,"_");await window.firebaseRemove(window.firebaseRef(window.firebaseDB,"email-bindings/"+n)),await window.firebaseRemove(window.firebaseRef(window.firebaseDB,"device-bindings/"+e)),await window.firebaseRemove(window.firebaseRef(window.firebaseDB,"approved-users/"+e));const o=window.firebaseRef(window.firebaseDB,"pending-users/"+e);await window.firebaseRemove(o),d("User access revoked and all records removed")}}catch(t){console.error("Error revoking user:",t),d("Failed to revoke access")}}window.handleLogin=N;window.handleLogout=J;window.switchAdminTab=q;window.handleUpload=V;window.deleteBook=G;window.migrateOldBooks=X;window.toggleDesktopAccess=Q;window.approveUser=ae;window.rejectUser=re;window.revokeUser=de;window.viewIdCard=ne;window.handleUserSearch=te;window.showCredentialsModal=C;window.copyToClipboard=$;async function le(e){e.preventDefault();const t=document.getElementById("emailjs-service-id").value.trim(),n=document.getElementById("emailjs-template-id").value.trim(),o=document.getElementById("emailjs-public-key").value.trim();try{const i=window.firebaseRef(window.firebaseDB,"settings/emailjs");await window.firebaseSet(i,{serviceId:t,templateId:n,publicKey:o,updatedAt:new Date().toISOString()}),d("EmailJS configuration saved successfully!")}catch(i){console.error("Error saving EmailJS config:",i),d("Failed to save configuration")}}window.saveEmailJSConfig=le;function ce(){document.addEventListener("contextmenu",e=>e.preventDefault()),document.addEventListener("keydown",e=>{if(e.key==="F12"||e.ctrlKey&&e.shiftKey&&(e.key==="I"||e.key==="J"||e.key==="C")||e.ctrlKey&&e.key==="U"||e.metaKey&&e.altKey&&(e.key==="i"||e.key==="I"||e.key==="j"||e.key==="J"||e.key==="c"||e.key==="C")||e.metaKey&&e.key==="u")return e.preventDefault(),!1})}ce();H();
