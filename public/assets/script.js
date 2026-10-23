(function () {
  const btn = document.getElementById('get');
  const img = document.getElementById('result');
  const code = document.getElementById('code');
  const exampleImg = document.getElementById('example-img');

  const elements = {
    name: document.getElementById('name'),
    theme: document.getElementById('theme'),
    padding: document.getElementById('padding'),
    offset: document.getElementById('offset'),
    align: document.getElementById('align'),
    scale: document.getElementById('scale'),
    pixelated: document.getElementById('pixelated'),
    darkmode: document.getElementById('darkmode'),
    num: document.getElementById('num'),
    prefix: document.getElementById('prefix')
  };

  // 初始化主题选择器
  function initThemeSelector() {
    const themeSelect = elements.theme;
    window.themeList.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme;
      option.textContent = theme;
      themeSelect.appendChild(option);
    });
  }

  // 初始化主题展示
  function initThemeGallery() {
    const themeContainer = document.getElementById('theme-container');
    window.themeList.forEach(theme => {
      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.theme = theme;
      
      const h5 = document.createElement('h5');
      h5.textContent = theme;
      
      const img = document.createElement('img');
      img.alt = theme;
      img.src = `/counter?name=demo&theme=${theme}`;
      
      item.appendChild(h5);
      item.appendChild(img);
      themeContainer.appendChild(item);
    });
  }

  // 更新示例图片
  function updateExampleImage() {
    exampleImg.src = `/counter?name=index${getQueryString()}`;
  }

  // 获取查询参数字符串
  function getQueryString() {
    const params = new URLSearchParams();
    
    if (elements.theme.value && elements.theme.value !== 'random') {
      params.append('theme', elements.theme.value);
    }
    if (elements.padding.value && elements.padding.value !== '7') {
      params.append('length', elements.padding.value);
    }
    if (elements.offset.value && elements.offset.value !== '0') {
      params.append('offset', elements.offset.value);
    }
    if (elements.scale.value && elements.scale.value !== '1') {
      params.append('scale', elements.scale.value);
    }
    if (elements.align.value && elements.align.value !== 'top') {
      params.append('align', elements.align.value);
    }
    if (!elements.pixelated.checked) {
      params.append('pixelated', '0');
    }
    if (elements.darkmode.value !== 'auto') {
      params.append('darkmode', elements.darkmode.value);
    }
    
    return params.toString() ? `?${params.toString()}` : '';
  }

  // 处理按钮点击
  function handleButtonClick() {
    const nameValue = elements.name.value.trim();
    if (!nameValue) {
      alert('请输入计数器名称');
      return;
    }

    const query = getQueryString();
    const imgSrc = `/counter?name=${nameValue}${query}`;

    img.src = `${imgSrc}&_=${Math.random()}`;
    btn.disabled = true;

    img.onload = () => {
      img.scrollIntoView({ block: 'start', behavior: 'smooth' });
      code.textContent = imgSrc;
      code.style.visibility = 'visible';
      btn.disabled = false;
    };

    img.onerror = () => {
      alert('生成图片失败，请检查参数');
      btn.disabled = false;
    };
  }

  // 初始化事件监听
  function initEventListeners() {
    btn.addEventListener('click', handleButtonClick);
    
    // 表单变化时更新示例图片
    Object.values(elements).forEach(el => {
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT') {
        el.addEventListener('change', updateExampleImage);
      }
    });
  }

  // 初始化页面
  function initPage() {
    // 更新URL示例
    document.getElementById('svg-url').textContent = `/counter?name=:name`;
    document.getElementById('theme-url').textContent = `/counter?name=:name&theme=moebooru`;
    
    // 初始化组件
    initThemeSelector();
    initThemeGallery();
    initEventListeners();
    updateExampleImage();
  }

  // 页面加载完成后初始化
  if (document.readyState === 'complete') {
    initPage();
  } else {
    window.addEventListener('DOMContentLoaded', initPage);
  }
})();
