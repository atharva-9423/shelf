import{initializeApp as v}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";import{getDatabase as p,ref as g,push as b,set as h,onValue as y,remove as w}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const o of e)if(o.type==="childList")for(const c of o.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&r(c)}).observe(document,{childList:!0,subtree:!0});function i(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?o.credentials="include":e.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(e){if(e.ep)return;e.ep=!0;const o=i(e);fetch(e.href,o)}})();const L={apiKey:"AIzaSyDLnZu7F42nu1UnqHkyWzClB5AX25Jds0o",authDomain:"e-book-4f4f8.firebaseapp.com",databaseURL:"https://e-book-4f4f8-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"e-book-4f4f8",storageBucket:"e-book-4f4f8.firebasestorage.app",messagingSenderId:"1052383218826",appId:"1:1052383218826:web:7c2e30520bf58177773173",measurementId:"G-5X14495FLX"},B=v(L),k=p(B);window.firebaseDB=k;window.firebaseRef=g;window.firebasePush=b;window.firebaseSet=h;window.firebaseOnValue=y;window.firebaseRemove=w;let u=!1,s=[],d=null,$=!1;function I(){return new Promise(n=>{const t=()=>{window.firebaseDB&&window.firebaseRef&&window.firebaseOnValue?n():setTimeout(t,100)};t()})}async function E(){try{l("Connecting to cloud..."),await I(),$=!0,d=localStorage.getItem("shelf_last_read"),C(),R()}catch(n){console.error("Failed to initialize:",n),l("Connection error. Please refresh.")}}function C(){const n=window.firebaseRef(window.firebaseDB,"books");window.firebaseOnValue(n,t=>{const i=t.val();i?(s=Object.entries(i).map(([r,e])=>({...e,id:r})),s.sort((r,e)=>new Date(e.createdAt)-new Date(r.createdAt))):s=[],O(),T(),u&&f()},t=>{console.error("Firebase read error:",t),l("Failed to load books")})}function M(n){const t=document.getElementById("nav-indicator"),i=document.getElementById("bottom-nav");if(t&&n&&i){const r=i.getBoundingClientRect(),e=n.getBoundingClientRect(),o=e.left-r.left+(e.width-32)/2;t.style.left=o+"px"}}function m(){const n=document.querySelector(".nav-item.active");n&&M(n)}window.addEventListener("load",m);window.addEventListener("resize",m);function R(){sessionStorage.getItem("shelf_admin")==="true"&&(u=!0,H())}function H(){document.getElementById("admin-login").classList.add("hidden"),document.getElementById("admin-panel").classList.remove("hidden"),f()}function O(){const n=document.getElementById("books-carousel"),t=document.getElementById("home-empty"),i=document.getElementById("continue-reading-section"),r=document.getElementById("continue-reading-card");if(s.length===0){n.innerHTML="",t.classList.remove("hidden"),i.classList.add("hidden");return}t.classList.add("hidden"),n.innerHTML=s.map(o=>`
    <div class="carousel-book" onclick="openBook('${o.id}')">
      <div class="carousel-book-cover">
        ${o.cover?`<img src="${o.cover}" alt="${a(o.title)}">`:"📚"}
      </div>
      <div class="carousel-book-author">${a(o.author)}</div>
    </div>
  `).join("");const e=d?s.find(o=>o.id===d):s[0];if(e){i.classList.remove("hidden");const o=Math.floor(Math.random()*40)+30;r.innerHTML=`
      <div class="continue-book-cover" onclick="openBook('${e.id}')">
        ${e.cover?`<img src="${e.cover}" alt="${a(e.title)}">`:"📖"}
      </div>
      <div class="continue-book-info">
        <div class="continue-book-title">${a(e.title)}</div>
        <div class="continue-book-chapter">Chapter 3 of 10</div>
        <div class="continue-book-rating">
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star empty">★</span>
        </div>
        <div class="progress-row">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${o}%"></div>
          </div>
          <span class="progress-text">${o}%</span>
        </div>
        <button class="play-btn" onclick="openBook('${e.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Play
        </button>
      </div>
      <button class="continue-more-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
    `}else i.classList.add("hidden")}function T(){const n=document.getElementById("library-grid"),t=document.getElementById("library-empty");if(s.length===0){n.innerHTML="",t.classList.remove("hidden");return}t.classList.add("hidden"),n.innerHTML=s.map(i=>`
    <div class="library-book" onclick="openBook('${i.id}')">
      <div class="library-book-cover">
        ${i.cover?`<img src="${i.cover}" alt="${a(i.title)}">`:"📖"}
      </div>
      <div class="library-book-title">${a(i.title)}</div>
      <div class="library-book-author">${a(i.author)}</div>
    </div>
  `).join("")}function f(){const n=document.getElementById("admin-books-list"),t=document.getElementById("admin-empty-state");if(s.length===0){n.innerHTML="",n.classList.add("hidden"),t.classList.remove("hidden");return}t.classList.add("hidden"),n.classList.remove("hidden"),n.innerHTML=s.map(i=>`
    <div class="admin-book-item">
      <div class="admin-book-info">
        <div class="admin-book-thumb">
          ${i.cover?`<img src="${i.cover}" alt="${a(i.title)}">`:"📖"}
        </div>
        <div class="admin-book-details">
          <h4>${a(i.title)}</h4>
          <p>${a(i.author)}</p>
        </div>
      </div>
      <button class="btn btn-danger" onclick="deleteBook('${i.id}')">Delete</button>
    </div>
  `).join("")}function l(n){const t=document.getElementById("toast");t.textContent=n,t.classList.add("show"),setTimeout(()=>{t.classList.remove("show")},2e3)}function a(n){const t=document.createElement("div");return t.textContent=n,t.innerHTML}document.addEventListener("DOMContentLoaded",E);
