document.addEventListener('DOMContentLoaded', () => {
  const themeSwitch = document.getElementById('theme-switch');
  const themeIcon = document.getElementById('theme-icon');
  
  if (!themeSwitch || !themeIcon) {
    console.warn('Theme switch elements not found');
    return;
  }

  // 检查用户之前是否设置过主题或系统偏好
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  // 设置初始主题
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  // 阻止链接默认行为
  themeSwitch.addEventListener('click', (e) => {
    e.preventDefault();
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeIcon(newTheme);
    }
  });
});

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'dark') {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    } else {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    }
  }
}
