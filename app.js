   require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.41.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
      // sample files
      const SAMPLE_FILES = {
        'index.html': "<!doctype html>\n<html>\n  <body>\n    <h1>سلام دنیا</h1>\n  </body>\n</html>",
        'app.js': "console.log('hello from app.js');\n",
        'style.css': "body{font-family: Vaziri; }\n"
      };

      const models = {};
      const files = {};
      Object.assign(files, SAMPLE_FILES);

      const editor = monaco.editor.create(document.getElementById('editor'), {
        value: SAMPLE_FILES['app.js'],
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        glyphMargin: true,
      });

      function extToLanguage(name){
        if(name.endsWith('.js')) return 'javascript';
        if(name.endsWith('.ts')) return 'typescript';
        if(name.endsWith('.css')) return 'css';
        if(name.endsWith('.html') || name.endsWith('.htm')) return 'html';
        if(name.endsWith('.json')) return 'json';
        if(name.endsWith('.php')) return 'php';
        return 'plaintext';
      }

      // create models
      Object.keys(files).forEach(path=>{ models[path] = monaco.editor.createModel(files[path], extToLanguage(path)); });
      let currentFile = Object.keys(models)[0];
      editor.setModel(models[currentFile]);

      // UI refs
      const fileList = document.getElementById('file-list');
      const tabs = document.getElementById('tabs');
      const currentFileLabel = document.getElementById('current-file');
      const status = document.getElementById('status');

      // render file list & tabs
      function renderFileList(){
        fileList.innerHTML = '';
        Object.keys(models).forEach(name=>{
          const el = document.createElement('div');
          el.className = 'flex items-center justify-between gap-2 p-2 rounded-md hover:bg-slate-800/50 cursor-pointer';
          el.innerHTML = `<div class=\"flex items-center gap-2\"><svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-4 w-4 text-slate-300\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M7 7h10M7 12h6m-6 5h10\"/></svg><div class=\"text-sm\">${name}</div></div><div class=\"text-xs text-slate-400\">⋯</div>`;
          el.onclick = ()=>{ switchToFile(name); };
          fileList.appendChild(el);
        });
      }

      function renderTabs(){
        tabs.innerHTML = '';
        Object.keys(models).forEach(name=>{
          const t = document.createElement('div');
          t.className = `px-3 py-1 rounded-md text-sm cursor-pointer ${name===currentFile? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-white/2'}`;
          t.textContent = name;
          t.onclick = ()=> switchToFile(name);
          tabs.appendChild(t);
        });
      }

      function switchToFile(name){
        files[currentFile] = editor.getValue();
        currentFile = name;
        editor.setModel(models[name]);
        currentFileLabel.textContent = name;
        setStatus('فایل: '+name);
        renderTabs();
      }

      renderFileList();
      renderTabs();
      currentFileLabel.textContent = currentFile;

      // buttons
      document.getElementById('btn-new-file').onclick = ()=>{
        const name = prompt('نام فایل (مثال: new.js):');
        if(!name) return;
        if(models[name]){ alert('فایل وجود دارد'); return; }
        models[name] = monaco.editor.createModel('', extToLanguage(name));
        files[name] = '';
        switchToFile(name);
        renderFileList();
      };

      document.getElementById('btn-save').onclick = ()=>{
        files[currentFile] = editor.getValue();
        localStorage.setItem('mini-ide-files', JSON.stringify(serializeModels()));
        setStatus('ذخیره شد (localStorage) ' + new Date().toLocaleTimeString());
      };

      // autosave
      let autosave = true;
      setInterval(()=>{
        if(!autosave) return;
        files[currentFile] = editor.getValue();
        localStorage.setItem('mini-ide-files', JSON.stringify(serializeModels()));
        document.getElementById('autosave').textContent = 'Autosave: On — ' + new Date().toLocaleTimeString();
      }, 3000);

      function serializeModels(){ const out = {}; Object.keys(models).forEach(k=> out[k] = models[k].getValue()); return out; }

      // load saved
      const saved = localStorage.getItem('mini-ide-files');
      if(saved){ try{ const obj = JSON.parse(saved); Object.keys(obj).forEach(k=>{ if(!models[k]) models[k] = monaco.editor.createModel(obj[k], extToLanguage(k)); else models[k].setValue(obj[k]); files[k] = obj[k]; }); currentFile = Object.keys(models)[0]; editor.setModel(models[currentFile]); renderFileList(); renderTabs(); setStatus('بارگذاری از localStorage'); }catch(e){ console.warn(e); } }

      // Command palette basic
      const cmdInput = document.getElementById('cmd');
      const commands = {
        'save': ()=> document.getElementById('btn-save').click(),
        'format': ()=> editor.getAction('editor.action.formatDocument')?.run(),
        'save-server': ()=> document.getElementById('btn-save-server')?.click()
      };
      cmdInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ const v = cmdInput.value.trim(); if(commands[v]) commands[v](); else alert('دستور پیدا نشد: '+v); cmdInput.value=''; } });

      function setStatus(t){ status.textContent = t; }

      // server save helper (uses saved config)
      async function saveFileToServer(path, content){
        const cfg = JSON.parse(localStorage.getItem('mini-ide-config')||'{}');
        if(!cfg.endpoint) return {ok:false, text:'endpoint not set'};
        try{
          const res = await fetch(cfg.endpoint, {method:'POST', headers:{'Content-Type':'application/json','x-api-key':cfg.key||''}, body: JSON.stringify({file: path, content})});
          const text = await res.text();
          return {ok:res.ok, text};
        }catch(e){ return {ok:false, text:String(e)} }
      }

      // save config
      document.getElementById('btn-save-config').onclick = ()=>{
        const ep = document.getElementById('api-endpoint').value.trim();
        const key = document.getElementById('api-key').value.trim();
        localStorage.setItem('mini-ide-config', JSON.stringify({endpoint: ep, key: key}));
        setStatus('تنظیمات ذخیره شد');
      };

      // Right: Chat
      const chatHistory = document.getElementById('chat-history');
      const chatInput = document.getElementById('chat-input');
      const chatSend = document.getElementById('chat-send');
      const btnClearChat = document.getElementById('btn-clear-chat');
      const btnSendTest = document.getElementById('btn-send-test');

      function appendChat(who, text){
        const el = document.createElement('div');
        el.className = 'max-w-[85%] px-3 py-2 rounded-xl whitespace-pre-wrap text-sm';
        if(who==='user'){ el.classList.add('bg-slate-800','self-start'); el.style.borderRadius='12px 12px 12px 2px'; }
        else { el.classList.add('bg-slate-700','self-end'); el.style.borderRadius='12px 12px 2px 12px'; }
        el.textContent = text;
        chatHistory.appendChild(el);
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }

      chatSend.onclick = ()=>{ sendChat(chatInput.value); chatInput.value=''; };
      chatInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ sendChat(chatInput.value); chatInput.value=''; } });

      async function sendChat(text){ if(!text) return; appendChat('user', text); setStatus('در حال پاسخ...');
        const cfg = JSON.parse(localStorage.getItem('mini-ide-config')||'{}');
        if(cfg.endpoint){
          try{
            const payload = { message: text };
            const res = await fetch(cfg.endpoint, { method:'POST', headers:{ 'Content-Type':'application/json','x-api-key': cfg.key||'' }, body: JSON.stringify(payload) });
            const data = await res.json();
            const botText = data.reply || data.result || JSON.stringify(data);
            appendChat('bot', botText);
            setStatus('پاسخ از API دریافت شد');
            return;
          }catch(e){ console.warn(e); appendChat('bot','خطا در تماس با API — پاسخ شبیه‌سازی شده'); setStatus('خطا در تماس با API'); return; }
        }

        // simulated reply
        setTimeout(()=>{ const r = simpleBotReply(text); appendChat('bot', r); setStatus('پاسخ شبیه‌سازی شد'); }, 450);
      }

      function simpleBotReply(text){ text = text.toLowerCase(); if(text.includes('سلام')||text.includes('درود')) return 'سلام! چطور می‌تونم کمکتون کنم؟'; if(text.includes('کمک')) return 'می‌تونم نمونه کد، دیباگ یا اتصال API رو توضیح بدم.'; if(text.includes('ذخیره')) return 'برای ذخیره روی سرور، endpoint را وارد و دکمه مربوطه را فشار دهید.'; return 'این یک پاسخ شبیه‌سازی شده است.'; }

      btnClearChat.onclick = ()=>{ chatHistory.innerHTML=''; };
      btnSendTest.onclick = ()=>{ sendChat('مثال: لطفاً نمونه ذخیره فایل را بده'); };

      // small extras: keyboard shortcuts
      window.addEventListener('keydown', (e)=>{
        if((e.ctrlKey||e.metaKey) && e.key==='s'){
          e.preventDefault(); document.getElementById('btn-save').click();
        }
        if((e.ctrlKey||e.metaKey) && e.key==='b'){
          e.preventDefault(); document.querySelector('aside')?.classList.toggle('hidden');
        }
      });

      setStatus('IDE آماده است');

      // expose API for future extensions
      window.IDE = { editor, monaco, models, files, saveFileToServer };

    });
