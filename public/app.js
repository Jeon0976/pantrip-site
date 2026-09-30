(() => {
  const $ = id => document.getElementById(id);
  const config = window.PANTRIP_SITE || {};
  const steps = [
    {ko:['사진 한 장.','찍거나 골라서 시작하세요. 바코드로도 찾을 수 있어요.','등록해 보기 →'],en:['Start with a photo.','Choose a photo or scan a barcode.','Try adding it →']},
    {ko:['날짜를 확인하세요.','이름과 유통기한, 보관 장소를 확인하고 등록하세요.','주방에서 보기 →'],en:['Check the date.','Check the name, expiry date and storage before saving.','See it in the kitchen →']},
    {ko:['주방에 담겼어요.','주방에서 물건을 확인하고, 다 썼다면 완료로 표시하세요.','처음부터 보기 ↺'],en:['It’s in your kitchen.','Find your item in the kitchen. Mark it used when you’re done.','Start again ↺']}
  ];
  const kitchens = [
    ['oak','우드','Oak'],['cafe','카페','Café'],['seaside','바닷가','Seaside'],
    ['camper','캠핑카','Camper'],['siberian','겨울집','Winter'],['spaceship','우주선','Spaceship'],
    ['thai','태국','Thai'],['mongolianGer','게르','Ger'],['campsite','캠핑','Campsite']
  ];
  let lang = 'ko', step = 0, kitchen = 0;
  const tabs = [...document.querySelectorAll('[data-step]')];
  const thumbnails = [...document.querySelectorAll('[data-kitchen]')];
  const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
  const video = $('app-video');
  let videoReady = false;
  let videoFailed = false;
  function renderStep() {
    const copy = steps[step][lang];
    $('step-title').textContent = copy[0];
    $('step-description').textContent = copy[1];
    $('demo-next').textContent = copy[2];
    $('step-counter').textContent = `0${step + 1} / 03`;
    $('demo-scene').dataset.state = String(step);
    tabs.forEach((tab,index) => {
      tab.setAttribute('aria-selected', String(index === step));
      tab.tabIndex = index === step ? 0 : -1;
    });
    $('demo-panel').setAttribute('aria-labelledby',tabs[step].id);
  }
  function renderKitchen() {
    const selected = kitchens[kitchen];
    $('gallery-room').src = `assets/kitchen-${selected[0]}.jpg`;
    $('gallery-room').alt = lang === 'ko' ? `${selected[1]} 주방` : `${selected[2]} kitchen`;
    $('gallery-name').textContent = selected[lang === 'ko' ? 1 : 2];
    $('gallery-count').textContent = `${String(kitchen + 1).padStart(2,'0')} / 09`;
    thumbnails.forEach((button,index) => button.setAttribute('aria-pressed',String(index === kitchen)));
  }
  function renderMotion() {
    const paused = document.body.classList.contains('motion-paused');
    $('motion').textContent = lang === 'ko' ? (paused ? '움직임 켜기' : '움직임 끄기') : (paused ? 'Resume motion' : 'Pause motion');
    $('motion').setAttribute('aria-pressed',String(paused));
  }
  function renderVideoNote() {
    if (videoFailed) {
      const message = lang === 'ko' ? '영상을 불러오지 못했습니다. 연결을 확인하고 페이지를 새로 열어주세요.' : 'The video could not load. Check your connection and reload this page.';
      $('video-note').textContent = message;
      $('video-fallback-text').textContent = message;
      return;
    }
    if (config.videoMode === "kitchen") {
      $("film-description").textContent = lang === "ko" ? "실제 앱에서 주방을 열어보세요." : "See the kitchen in the app.";
      $("video-note").textContent = lang === "ko" ? "기존 개발 버전의 실제 주방 화면입니다. 예시 상품이 표시됩니다." : "Actual kitchen recording from an earlier development build, with sample items.";
      return;
    }
    $('video-note').textContent = videoReady
      ? (lang === 'ko' ? '실제 앱 화면 녹화입니다. 단계를 누르면 해당 장면으로 이동합니다.' : 'Recorded in the app. Choose a step to jump to that scene.')
      : (lang === 'ko' ? '영상은 준비되면 여기에 표시됩니다.' : 'The recording will appear here when ready.');
  }
  function renderLanguage() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-ko][data-en]').forEach(el => { el.textContent = el.dataset[lang]; });
    document.querySelectorAll('[data-ko-aria]').forEach(el => el.setAttribute('aria-label',el.getAttribute(`data-${lang}-aria`)));
    $('language').textContent = lang === 'ko' ? 'EN' : '한국어';
    $('language').setAttribute('aria-label',lang === 'ko' ? 'Switch to English' : '한국어로 변경');
    document.title = 'Pantrip: Food & Kitchen';
    document.querySelector('meta[name="description"]').content = lang === 'ko' ? '사진으로 등록하고, 주방에서 유통기한을 확인하세요. Pantrip: Food & Kitchen iPhone 앱.' : 'Add a photo. Keep track of expiry dates in your kitchen. Pantrip: Food & Kitchen for iPhone.';
    try {
      const url = config.privacyURL === 'privacy.html' ? null : new URL(config.privacyURL);
      if(config.privacyURL === 'privacy.html' || url?.protocol === 'https:') {
        $('privacy-link').href = url?.href ?? 'privacy.html';
        $('privacy-link').textContent = lang === 'ko' ? '개인정보처리방침' : 'Privacy policy';
      }
    } catch { /* Keep the privacy contact until a public policy is configured. */ }
    renderStep(); renderKitchen(); renderMotion(); renderVideoNote();
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click',() => {step=index;renderStep();});
    tab.addEventListener('keydown',event => {
      const keys = ['ArrowRight','ArrowLeft','Home','End'];
      if(!keys.includes(event.key)) return;
      event.preventDefault();
      step = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (step + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      renderStep(); tabs[step].focus();
    });
  });
  $('demo-next').addEventListener('click',() => {step=(step+1)%3;renderStep();});
  thumbnails.forEach((button,index) => button.addEventListener('click',() => {kitchen=index;renderKitchen();}));
  $('previous-kitchen').addEventListener('click',() => {kitchen=(kitchen+8)%9;renderKitchen();});
  $('next-kitchen').addEventListener('click',() => {kitchen=(kitchen+1)%9;renderKitchen();});
  $('language').addEventListener('click',() => {lang=lang==='ko'?'en':'ko';renderLanguage();});
  $('motion').addEventListener('click',() => {
    document.body.classList.toggle('motion-paused');
    if(document.body.classList.contains('motion-paused')) video.pause();
    renderMotion();
  });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reflectReducedMotion() { $('motion').hidden = reduced.matches; if(reduced.matches) video.pause(); }
  reduced.addEventListener('change',reflectReducedMotion);
  reflectReducedMotion();
  const kitchenOnly = config.videoMode === "kitchen";
  $("kitchen-play").hidden = !kitchenOnly;
  $("kitchen-play").disabled = true;
  $("kitchen-play").addEventListener("click", () => {
    if (!videoReady || videoFailed) return;
    video.play().catch(() => video.focus());
  });
  chapterButtons.forEach(button => { button.hidden = kitchenOnly; });
  const chapters = config.videoChapters;
  const validChapters = Array.isArray(chapters) && chapters.length === 3 && chapters.every((time,index) => Number.isFinite(time) && time >= 0 && (index===0 || time > chapters[index-1]));
  if(typeof config.videoURL === 'string' && /^assets\/[\w./-]+\.mp4$/.test(config.videoURL) && !config.videoURL.includes('..')) {
    video.src = config.videoURL;
    video.hidden = false;
    $('video-pending').hidden = true;
    video.addEventListener('loadedmetadata',() => {
      videoReady = true; videoFailed = false;
      $("kitchen-play").disabled = !kitchenOnly;
      chapterButtons.forEach(button => {button.disabled = !validChapters || chapters[2] >= video.duration;});
      renderVideoNote();
    });
    video.addEventListener('error',() => {
      videoReady = false; videoFailed = true; $("kitchen-play").disabled = true; video.hidden = true; $('video-pending').hidden = false;
      chapterButtons.forEach(button => {button.disabled = true;}); renderVideoNote();
    });
    video.addEventListener('timeupdate',() => {
      if(!validChapters) return;
      let active = 0;
      chapters.forEach((time,index) => {if(video.currentTime >= time) active=index;});
      chapterButtons.forEach((button,index) => button.classList.toggle('active',index===active));
    });
    chapterButtons.forEach((button,index) => button.addEventListener('click',() => {
      if(!videoReady || !validChapters || button.disabled) return;
      video.currentTime = chapters[index];
      video.play().catch(() => {video.focus();});
    }));
  }
  renderLanguage();
})();
