
    // ================== State Management ==================
    let currentUser = null;
    let games = [];
    let orders = [];
    let notifications = [];
    let p2pListings = [];
    let currentSlide = 0;
    let sliderInterval = null;
    let selectedPaymentMethod = null;
    let chatTimer = null;
    let chatSeconds = 0;
    let isChatMinimized = false;
    let isChatFullscreen = false;
    
    // Default config
    const defaultConfig = {
      store_name: 'BLACK',
      welcome_message: 'مرحباً بك في متجر شحن الألعاب'
    };
    
    let config = { ...defaultConfig };
    
    // ================== Initialize ==================
    document.addEventListener('DOMContentLoaded', async () => {
      // Wait for Firebase to initialize
      await waitForFirebase();
      
      // Check for saved user
      const savedUser = localStorage.getItem('blackstore_user');
      if (savedUser) {
        currentUser = JSON.parse(savedUser);
        await loadUserData();
        updateUI();
      }
      
      // Load games and data
      await loadGames();
      await loadSliderContent();
      await loadP2PListings();
      
      // Start slider
      startSlider();
      
      // Setup forms
      setupForms();
      
      // Initialize Element SDK
      if (window.elementSdk) {
        window.elementSdk.init({
          defaultConfig,
          onConfigChange: async (newConfig) => {
            config = { ...config, ...newConfig };
            // Update UI with new config if needed
          },
          mapToCapabilities: () => ({
            recolorables: [],
            borderables: [],
            fontEditable: undefined,
            fontSizeable: undefined
          }),
          mapToEditPanelValues: (cfg) => new Map([
            ['store_name', cfg.store_name || defaultConfig.store_name],
            ['welcome_message', cfg.welcome_message || defaultConfig.welcome_message]
          ])
        });
      }
    });
    
    async function waitForFirebase() {
      return new Promise((resolve) => {
        const checkFirebase = setInterval(() => {
          if (window.firebaseDB) {
            clearInterval(checkFirebase);
            resolve();
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkFirebase);
          resolve();
        }, 5000);
      });
    }
    
    // ================== Firebase Operations ==================
    async function saveToFirebase(path, data) {
      if (!window.firebaseDB) return;
      try {
        await window.firebaseSet(window.firebaseRef(window.firebaseDB, path), data);
        return true;
      } catch (error) {
        console.error('Firebase save error:', error);
        return false;
      }
    }
    
    async function getFromFirebase(path) {
      if (!window.firebaseDB) return null;
      try {
        const snapshot = await window.firebaseGet(window.firebaseRef(window.firebaseDB, path));
        return snapshot.exists() ? snapshot.val() : null;
      } catch (error) {
        console.error('Firebase get error:', error);
        return null;
      }
    }
    
    async function pushToFirebase(path, data) {
      if (!window.firebaseDB) return null;
      try {
        const newRef = window.firebasePush(window.firebaseRef(window.firebaseDB, path));
        await window.firebaseSet(newRef, data);
        return newRef.key;
      } catch (error) {
        console.error('Firebase push error:', error);
        return null;
      }
    }
    
    // ================== User Management ==================
    function generateUserId() {
      return Math.random().toString().slice(2, 14).padEnd(12, '0');
    }
    
    async function loadUserData() {
      if (!currentUser) return;
      
      const userData = await getFromFirebase(`users/${currentUser.id}`);
      if (userData) {
        currentUser = { ...currentUser, ...userData };
        localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
      }
      
      // Load orders
      const userOrders = await getFromFirebase(`orders/${currentUser.id}`);
      if (userOrders) {
        orders = Object.entries(userOrders).map(([key, value]) => ({ id: key, ...value }));
      }
      
      // Load notifications
      const userNotifications = await getFromFirebase(`notifications/${currentUser.id}`);
      if (userNotifications) {
        notifications = Object.entries(userNotifications).map(([key, value]) => ({ id: key, ...value }));
      }
    }
    
    function updateUI() {
      const guestView = document.getElementById('guestView');
      const loggedInView = document.getElementById('loggedInView');
      const logoutBtn = document.getElementById('logoutBtn');
      
      if (currentUser) {
        guestView.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        loggedInView.classList.add('flex');
        logoutBtn.classList.remove('hidden');
        logoutBtn.classList.add('flex');
        
        // Update header
        document.getElementById('headerUsername').textContent = currentUser.name;
        document.getElementById('headerBalance').textContent = (currentUser.balance || 0).toLocaleString();
        document.getElementById('headerAvatar').textContent = currentUser.name.charAt(0);
        
        // Update sidebar
        document.getElementById('sidebarUsername').textContent = currentUser.name;
        document.getElementById('sidebarUserId').textContent = `ID: ${currentUser.id}`;
        document.getElementById('sidebarAvatar').textContent = currentUser.name.charAt(0);
        document.getElementById('sidebarBalance').textContent = `${(currentUser.balance || 0).toLocaleString()} ج.س`;
        
        // Update recent orders
        updateRecentOrders();
        updateRecentNotifications();
      } else {
        guestView.classList.remove('hidden');
        loggedInView.classList.add('hidden');
        loggedInView.classList.remove('flex');
        logoutBtn.classList.add('hidden');
        logoutBtn.classList.remove('flex');
        
        document.getElementById('sidebarUsername').textContent = 'مرحباً بك';
        document.getElementById('sidebarUserId').textContent = 'ID: ------';
        document.getElementById('sidebarAvatar').textContent = '؟';
        document.getElementById('sidebarBalance').textContent = '0 ج.س';
      }
    }
    
    function updateRecentOrders() {
      const container = document.getElementById('recentOrders');
      const recentOrders = orders.slice(-3).reverse();
      
      if (recentOrders.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">لا توجد طلبات</p>';
        return;
      }
      
      container.innerHTML = recentOrders.map(order => `
        <div class="flex items-center justify-between p-2 bg-[#0a0a1a] rounded-lg">
          <div class="flex items-center gap-2">
            <span class="text-lg">${order.type === 'balance' ? '💳' : '🎮'}</span>
            <div>
              <p class="text-xs font-medium">${order.title}</p>
              <p class="text-xs text-gray-500">${order.amount} ج.س</p>
            </div>
          </div>
          <span class="text-xs px-2 py-1 rounded ${getStatusClass(order.status)}">${getStatusText(order.status)}</span>
        </div>
      `).join('');
    }
    
    function updateRecentNotifications() {
      const container = document.getElementById('recentNotifications');
      const recentNotifications = notifications.slice(-3).reverse();
      
      if (recentNotifications.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">لا توجد إشعارات</p>';
        return;
      }
      
      container.innerHTML = recentNotifications.map(notif => `
        <div class="p-2 bg-[#0a0a1a] rounded-lg">
          <p class="text-xs">${notif.message}</p>
          <p class="text-xs text-gray-500 mt-1">${formatTime(notif.timestamp)}</p>
        </div>
      `).join('');
    }
    
    function getStatusClass(status) {
      switch (status) {
        case 'pending': return 'bg-yellow-500/20 text-yellow-400';
        case 'completed': return 'bg-green-500/20 text-green-400';
        case 'cancelled': return 'bg-red-500/20 text-red-400';
        default: return 'bg-gray-500/20 text-gray-400';
      }
    }
    
    function getStatusText(status) {
      switch (status) {
        case 'pending': return 'قيد المراجعة';
        case 'completed': return 'مكتمل';
        case 'cancelled': return 'ملغي';
        default: return status;
      }
    }
    
    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleDateString('ar-SA') + ' ' + date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
    
    // ================== Authentication ==================
    function showAuthModal(type) {
      const modal = document.getElementById('authModal');
      const loginForm = document.getElementById('loginForm');
      const registerForm = document.getElementById('registerForm');
      const title = document.getElementById('authTitle');
      
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      
      if (type === 'login') {
        title.textContent = 'تسجيل الدخول';
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        title.textContent = 'إنشاء حساب جديد';
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }
    }
    
    function closeAuthModal() {
      const modal = document.getElementById('authModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    
    function setupForms() {
      // Login form
      document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phone = document.getElementById('loginPhone').value;
        const password = document.getElementById('loginPassword').value;
        
        // Check in Firebase
        const users = await getFromFirebase('users');
        if (users) {
          const userEntry = Object.entries(users).find(([id, user]) => 
            (user.phone === phone || id === phone) && user.password === password
          );
          
          if (userEntry) {
            currentUser = { id: userEntry[0], ...userEntry[1] };
            localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
            await loadUserData();
            updateUI();
            closeAuthModal();
            showToast('تم تسجيل الدخول بنجاح', 'success');
            return;
          }
        }
        
        showToast('رقم الهاتف أو كلمة المرور غير صحيحة', 'error');
      });
      
      // Register form
      document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('regName').value;
        const phone = document.getElementById('regPhone').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        
        if (password !== confirmPassword) {
          showToast('كلمة المرور غير متطابقة', 'error');
          return;
        }
        
        // Check if phone exists
        const users = await getFromFirebase('users');
        if (users) {
          const existingUser = Object.values(users).find(u => u.phone === phone);
          if (existingUser) {
            showToast('رقم الهاتف مسجل مسبقاً', 'error');
            return;
          }
        }
        
        const userId = generateUserId();
        const newUser = {
          name,
          phone,
          password,
          balance: 0,
          createdAt: Date.now(),
          lastNameChange: 0
        };
        
        await saveToFirebase(`users/${userId}`, newUser);
        
        currentUser = { id: userId, ...newUser };
        localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
        
        updateUI();
        closeAuthModal();
        showToast(`تم إنشاء حسابك بنجاح! معرفك: ${userId}`, 'success');
      });
      
      // Settings form
      document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) return;
        
        const name = document.getElementById('settingsName').value;
        const phone = document.getElementById('settingsPhone').value;
        const password = document.getElementById('settingsPassword').value;
        
        const updates = {};
        
        if (name && name !== currentUser.name) {
          const lastChange = currentUser.lastNameChange || 0;
          const daysSinceChange = (Date.now() - lastChange) / (1000 * 60 * 60 * 24);
          
          if (daysSinceChange < 30) {
            const daysLeft = Math.ceil(30 - daysSinceChange);
            showToast(`يمكنك تغيير الاسم بعد ${daysLeft} يوم`, 'error');
            return;
          }
          
          updates.name = name;
          updates.lastNameChange = Date.now();
        }
        
        if (phone && phone !== currentUser.phone) {
          updates.phone = phone;
        }
        
        if (password) {
          updates.password = password;
        }
        
        if (Object.keys(updates).length > 0) {
          await window.firebaseUpdate(window.firebaseRef(window.firebaseDB, `users/${currentUser.id}`), updates);
          currentUser = { ...currentUser, ...updates };
          localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
          updateUI();
          showToast('تم حفظ التغييرات', 'success');
        }
        
        closeSettingsModal();
      });
      
      // Sell account form
      document.getElementById('sellAccountForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
          showToast('يجب تسجيل الدخول أولاً', 'error');
          return;
        }
        
        const game = document.getElementById('sellGame').value;
        const title = document.getElementById('sellTitle').value;
        const description = document.getElementById('sellDescription').value;
        const price = parseInt(document.getElementById('sellPrice').value);
        
        const listing = {
          sellerId: currentUser.id,
          sellerName: currentUser.name,
          game,
          title,
          description,
          price,
          status: 'available',
          createdAt: Date.now()
        };
        
        await pushToFirebase('p2p_listings', listing);
        await loadP2PListings();
        
        document.getElementById('sellAccountForm').reset();
        showToast('تم نشر الإعلان بنجاح', 'success');
        switchP2PTab('buy');
      });
      
      // Chat input
      document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendChatMessage();
        }
      });
    }
    
    function logout() {
      currentUser = null;
      orders = [];
      notifications = [];
      localStorage.removeItem('blackstore_user');
      updateUI();
      toggleSidebar();
      showToast('تم تسجيل الخروج', 'success');
    }
    
    // ================== Games ==================
    async function loadGames() {
      // Load games from Firebase or use defaults
      const savedGames = await getFromFirebase('games');
      
      if (savedGames) {
        games = Object.entries(savedGames).map(([id, game]) => ({ id, ...game }));
      } else {
        // Default games
        games = [
          { id: '1', name: 'PUBG Mobile', icon: '🔫', category: 'popular', color: 'from-orange-500 to-yellow-500', offers: [
            { id: '1', name: '60 UC', price: 500 },
            { id: '2', name: '325 UC', price: 2500 },
            { id: '3', name: '660 UC', price: 5000 },
            { id: '4', name: '1800 UC', price: 12500 },
            { id: '5', name: '3850 UC', price: 25000 }
          ]},
          { id: '2', name: 'Free Fire', icon: '🔥', category: 'popular', color: 'from-red-500 to-orange-500', offers: [
            { id: '1', name: '100 جوهرة', price: 300 },
            { id: '2', name: '310 جوهرة', price: 900 },
            { id: '3', name: '520 جوهرة', price: 1500 },
            { id: '4', name: '1060 جوهرة', price: 3000 },
            { id: '5', name: '2180 جوهرة', price: 6000 }
          ]},
          { id: '3', name: 'Mobile Legends', icon: '⚔️', category: 'popular', color: 'from-blue-500 to-purple-500', offers: [
            { id: '1', name: '86 جوهرة', price: 500 },
            { id: '2', name: '172 جوهرة', price: 1000 },
            { id: '3', name: '257 جوهرة', price: 1500 },
            { id: '4', name: '706 جوهرة', price: 4000 },
            { id: '5', name: '2195 جوهرة', price: 12000 }
          ]},
          { id: '4', name: 'Clash of Clans', icon: '🏰', category: 'new', color: 'from-green-500 to-emerald-500', offers: [
            { id: '1', name: '500 جوهرة', price: 700 },
            { id: '2', name: '1200 جوهرة', price: 1500 },
            { id: '3', name: '2500 جوهرة', price: 3000 },
            { id: '4', name: '6500 جوهرة', price: 7000 },
            { id: '5', name: '14000 جوهرة', price: 14000 }
          ]},
          { id: '5', name: 'Genshin Impact', icon: '⭐', category: 'new', color: 'from-indigo-500 to-cyan-500', offers: [
            { id: '1', name: '60 كريستالة', price: 500 },
            { id: '2', name: '330 كريستالة', price: 2500 },
            { id: '3', name: '1090 كريستالة', price: 7500 },
            { id: '4', name: '2240 كريستالة', price: 15000 },
            { id: '5', name: '6480 كريستالة', price: 40000 }
          ]},
          { id: '6', name: 'Fortnite', icon: '🎯', category: 'popular', color: 'from-purple-500 to-pink-500', offers: [
            { id: '1', name: '1000 V-Bucks', price: 2500 },
            { id: '2', name: '2800 V-Bucks', price: 6500 },
            { id: '3', name: '5000 V-Bucks', price: 11000 },
            { id: '4', name: '13500 V-Bucks', price: 27000 }
          ]},
          { id: '7', name: 'Roblox', icon: '🎮', category: 'new', color: 'from-red-500 to-pink-500', offers: [
            { id: '1', name: '400 Robux', price: 1500 },
            { id: '2', name: '800 Robux', price: 3000 },
            { id: '3', name: '1700 Robux', price: 6000 },
            { id: '4', name: '4500 Robux', price: 15000 }
          ]},
          { id: '8', name: 'Call of Duty Mobile', icon: '💀', category: 'popular', color: 'from-gray-600 to-gray-800', offers: [
            { id: '1', name: '80 CP', price: 500 },
            { id: '2', name: '400 CP', price: 2500 },
            { id: '3', name: '880 CP', price: 5000 },
            { id: '4', name: '2400 CP', price: 12500 }
          ]}
        ];
        
        // Save defaults to Firebase
        for (const game of games) {
          await saveToFirebase(`games/${game.id}`, game);
        }
      }
      
      renderGames();
    }
    
    function renderGames(filter = 'all') {
      const container = document.getElementById('gamesGrid');
      let filteredGames = games;
      
      if (filter !== 'all') {
        filteredGames = games.filter(g => g.category === filter);
      }
      
      container.innerHTML = filteredGames.map(game => `
        <div class="game-card glass-card rounded-xl p-4 cursor-pointer" onclick="openGameModal('${game.id}')">
          <div class="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-3">
            <span class="text-3xl">${game.icon}</span>
          </div>
          <h3 class="text-center font-bold text-sm">${game.name}</h3>
          <p class="text-center text-xs text-gray-400 mt-1">${game.offers?.length || 0} عروض</p>
        </div>
      `).join('');
    }
    
    function filterGames(filter) {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-500');
        btn.classList.add('bg-[#1a1a2e]');
      });
      document.querySelector(`[data-filter="${filter}"]`).classList.remove('bg-[#1a1a2e]');
      document.querySelector(`[data-filter="${filter}"]`).classList.add('bg-indigo-500');
      renderGames(filter);
    }
    
    // في index.html - دالة openGameModal المعدلة
function openGameModal(gameId) {
  const game = games.find(g => g.id === gameId);
  if (!game) return;
  
  document.getElementById('gameModalTitle').textContent = game.name;
  document.getElementById('gameModalIcon').textContent = game.icon;
  document.getElementById('gameModalDesc').textContent = `اختر الباقة المناسبة لك من ${game.name}`;
  document.getElementById('gameModalBanner').className = `h-48 rounded-t-2xl bg-gradient-to-br ${game.color} flex items-center justify-center`;
  
  const offersContainer = document.getElementById('gameOffers');
  
  // التحقق من وجود العروض
  if (!game.offers || !Array.isArray(game.offers) || game.offers.length === 0) {
    offersContainer.innerHTML = `
      <div class="glass-card rounded-xl p-4 text-center">
        <p class="text-gray-400">لا توجد عروض متاحة حالياً</p>
        <p class="text-sm text-gray-500 mt-2">يرجى المحاولة لاحقاً</p>
      </div>
    `;
  } else {
    offersContainer.innerHTML = game.offers.map((offer, index) => `
      <div class="glass-card rounded-xl p-4 flex items-center justify-between hover:border-indigo-500 transition-all">
        <div>
          <p class="font-bold">${offer.name || 'عرض'}</p>
          <p class="text-sm text-gray-400">${game.name}</p>
        </div>
        <div class="text-left">
          <p class="font-black text-lg gradient-text">${(offer.price || 0).toLocaleString()} ج.س</p>
          <button onclick="buyOffer('${game.id}', ${index})" class="mt-2 px-4 py-1 bg-indigo-500 rounded-lg text-sm hover:bg-indigo-600 transition-all">
            شراء
          </button>
        </div>
      </div>
    `).join('');
  }
  
  document.getElementById('gameModal').classList.remove('hidden');
}
    
    function closeGameModal() {
      document.getElementById('gameModal').classList.add('hidden');
    }
    // ================== انتقال إلى موقع P2P ==================
function goToP2PSite() {
  if (!currentUser) {
    showToast('يجب تسجيل الدخول أولاً', 'error');
    showAuthModal('login');
    return;
  }
  
  // إنشاء توكين الجلسة
  const sessionToken = btoa(JSON.stringify({
    userId: currentUser.id,
    name: currentUser.name,
    phone: currentUser.phone,
    balance: currentUser.balance,
    timestamp: Date.now()
  }));
  
  // حفظ التوكين محلياً للاستخدام الفوري
  localStorage.setItem('p2p_session', sessionToken);
  
  // الانتقال إلى موقع P2P
  window.open('/p2p/index.html', '_blank');
}
    // في الموقع الرئيسي (index.html) - دالة شراء العرض
// في index.html - دالة buyOffer المعدلة
async function buyOffer(gameId, offerIndex) {
  // التحقق من تسجيل الدخول
  if (!currentUser) {
    showToast('يجب تسجيل الدخول أولاً', 'error');
    closeGameModal();
    showAuthModal('login');
    return;
  }
  
  // البحث عن اللعبة
  const game = games.find(g => g.id === gameId);
  if (!game) {
    showToast('اللعبة غير موجودة', 'error');
    return;
  }
  
  // التحقق من وجود العروض
  if (!game.offers || !Array.isArray(game.offers) || game.offers.length === 0) {
    showToast('لا توجد عروض متاحة لهذه اللعبة', 'error');
    return;
  }
  
  // استخدام الفهرس للحصول على العرض
  const index = parseInt(offerIndex);
  if (isNaN(index) || index < 0 || index >= game.offers.length) {
    showToast('العرض غير موجود', 'error');
    return;
  }
  
  const offer = game.offers[index];
  if (!offer) {
    showToast('العرض غير موجود', 'error');
    return;
  }
  
  // التحقق من الرصيد
  const currentBalance = currentUser.balance || 0;
  if (currentBalance < offer.price) {
    showToast(`رصيدك غير كافي. المطلوب: ${offer.price} ج.س ، رصيدك: ${currentBalance} ج.س`, 'error');
    closeGameModal();
    showAddBalance();
    return;
  }
  
  // طلب معلومات اللاعب
  const playerInfo = prompt(`أدخل معلومات اللاعب لشحن ${game.name}\n(رقم ID اللاعب أو اسم المستخدم):`, "");
  
  if (!playerInfo) {
    showToast('يجب إدخال معلومات اللاعب', 'warning');
    return;
  }
  
  // تأكيد الشراء
  const confirmPurchase = confirm(
    `تأكيد طلب الشراء:\n\n` +
    `اللعبة: ${game.name}\n` +
    `الباقة: ${offer.name}\n` +
    `المبلغ: ${offer.price} ج.س\n` +
    `معلومات اللاعب: ${playerInfo}\n\n` +
    `هل تريد المتابعة؟`
  );
  
  if (!confirmPurchase) return;
  
  try {
    showToast('جاري معالجة طلبك...', 'info');
    
    // خصم المبلغ من الرصيد
    const newBalance = currentBalance - offer.price;
    await saveToFirebase(`users/${currentUser.id}/balance`, newBalance);
    
    // تحديث بيانات المستخدم المحلية
    currentUser.balance = newBalance;
    localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
    
    // إنشاء الطلب في Firebase
    const orderId = generateOrderId();
    const orderData = {
      type: 'game',
      orderType: 'game',
      gameId: gameId,
      gameName: game.name,
      offerId: offer.id || `offer_${index}`,
      offerName: offer.name,
      playerInfo: playerInfo,
      amount: offer.price,
      status: 'pending',
      createdAt: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      phone: currentUser.phone,
      title: `${game.name} - ${offer.name}`,
      estimatedTime: '2-5 دقائق',
      processedBy: null,
      processedAt: null
    };
    
    // حفظ الطلب في قاعدة البيانات
    await saveToFirebase(`orders/${currentUser.id}/${orderId}`, orderData);
    
    // إضافة إلى المصفوفة المحلية
    if (!orders) orders = [];
    orders.push({
      id: orderId,
      ...orderData
    });
    
    // إرسال إشعار للمستخدم
    const notificationId = await pushToFirebase(`notifications/${currentUser.id}`, {
      type: 'order',
      message: `تم استلام طلبك: ${game.name} - ${offer.name}`,
      orderId: orderId,
      amount: offer.price,
      timestamp: Date.now(),
      read: false
    });
    
    if (!notifications) notifications = [];
    notifications.push({
      id: notificationId,
      type: 'order',
      message: `تم استلام طلبك: ${game.name} - ${offer.name}`,
      timestamp: Date.now(),
      read: false
    });
    
    // تحديث الواجهة
    updateUI();
    
    // إظهار رسالة النجاح
    showToast(`تم إرسال طلبك بنجاح! رقم الطلب: ${orderId.substring(0, 8)}`, 'success');
    
    // إغلاق نافذة اللعبة
    closeGameModal();
    
    // إظهار تفاصيل الطلب للمستخدم
    setTimeout(() => {
      alert(
        `🎉 *تم استلام طلبك بنجاح*\n\n` +
        `🆔 رقم الطلب: ${orderId.substring(0, 8)}\n` +
        `🎮 اللعبة: ${game.name}\n` +
        `📦 الباقة: ${offer.name}\n` +
        `💰 المبلغ: ${offer.price} ج.س\n` +
        `👤 معلومات اللاعب: ${playerInfo}\n` +
        `⏰ مدة المعالجة: 2-5 دقائق\n\n` +
        `📱 يمكنك متابعة حالة الطلب من قسم "طلباتي" في القائمة الجانبية.`
      );
    }, 500);
    
  } catch (error) {
    console.error('خطأ في معالجة الطلب:', error);
    showToast('حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى', 'error');
    
    // استعادة الرصيد في حالة الخطأ
    if (currentUser) {
      await saveToFirebase(`users/${currentUser.id}/balance`, currentBalance);
      currentUser.balance = currentBalance;
      localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
    }
  }
}

// دالة مساعدة لإنشاء ID للطلب
function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `order_${timestamp}_${random}`;
}

// دالة مساعدة لحفظ البيانات في Firebase
async function saveToFirebase(path, data) {
  if (!window.firebaseDB || !window.firebaseRef || !window.firebaseSet) {
    console.error('Firebase غير مهيئ');
    throw new Error('Firebase غير مهيئ');
  }
  
  const dbRef = window.firebaseRef(window.firebaseDB, path);
  await window.firebaseSet(dbRef, data);
  return true;
}

// دالة مساعدة لإضافة بيانات إلى Firebase
async function pushToFirebase(path, data) {
  if (!window.firebaseDB || !window.firebaseRef || !window.firebasePush) {
    console.error('Firebase غير مهيئ');
    throw new Error('Firebase غير مهيئ');
  }
  
  const dbRef = window.firebaseRef(window.firebaseDB, path);
  const newRef = window.firebasePush(dbRef);
  await window.firebaseSet(newRef, data);
  return newRef.key;
}
    // ================== Slider ==================
    async function loadSliderContent() {
      const savedSlides = await getFromFirebase('slides');
      let slides = [];
      
      if (savedSlides) {
        slides = Object.values(savedSlides);
      } else {
        slides = [
          { title: 'عروض حصرية 🔥', subtitle: 'احصل على خصم 20% على جميع شحنات PUBG', gradient: 'from-orange-500 via-red-500 to-pink-500', icon: '🔫' },
          { title: 'جديد! Genshin Impact ⭐', subtitle: 'الآن متوفر شحن كريستالات Genesis', gradient: 'from-indigo-500 via-purple-500 to-pink-500', icon: '⭐' },
          { title: 'شحن فوري ⚡', subtitle: 'استلم رصيدك خلال دقائق معدودة', gradient: 'from-cyan-500 via-blue-500 to-indigo-500', icon: '⚡' }
        ];
      }
      
      const container = document.getElementById('heroSlider');
      container.innerHTML = slides.map((slide, index) => `
        <div class="slide min-w-full h-48 md:h-64 bg-gradient-to-r ${slide.gradient} flex items-center justify-center p-6">
          <div class="text-center">
            <span class="text-5xl md:text-6xl mb-4 block float-animation">${slide.icon}</span>
            <h2 class="text-2xl md:text-4xl font-black mb-2">${slide.title}</h2>
            <p class="text-sm md:text-lg opacity-90">${slide.subtitle}</p>
          </div>
        </div>
      `).join('');
      
      const dotsContainer = document.getElementById('sliderDots');
      dotsContainer.innerHTML = slides.map((_, index) => `
        <button onclick="goToSlide(${index})" class="slider-dot w-3 h-3 rounded-full ${index === 0 ? 'bg-white' : 'bg-white/50'} transition-all"></button>
      `).join('');
    }
    
    function startSlider() {
      sliderInterval = setInterval(() => {
        nextSlide();
      }, 5000);
    }
    
    function nextSlide() {
      const slides = document.querySelectorAll('#heroSlider .slide');
      currentSlide = (currentSlide + 1) % slides.length;
      updateSlider();
    }
    
    function prevSlide() {
      const slides = document.querySelectorAll('#heroSlider .slide');
      currentSlide = (currentSlide - 1 + slides.length) % slides.length;
      updateSlider();
    }
    
    function goToSlide(index) {
      currentSlide = index;
      updateSlider();
    }
    
    function updateSlider() {
      const track = document.getElementById('heroSlider');
      track.style.transform = `translateX(${currentSlide * 100}%)`;
      
      document.querySelectorAll('.slider-dot').forEach((dot, index) => {
        dot.className = `slider-dot w-3 h-3 rounded-full ${index === currentSlide ? 'bg-white' : 'bg-white/50'} transition-all`;
      });
    }
    
    // ================== Sidebar ==================
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      
      sidebar.classList.toggle('translate-x-full');
      overlay.classList.toggle('hidden');
    }
    
    // ================== Balance ==================
    // دالة إظهار نافذة إضافة الرصيد
function showAddBalance() {
  if (!currentUser) {
    showToast('يجب تسجيل الدخول أولاً', 'error');
    showAuthModal('login');
    return;
  }
  
  const modal = document.getElementById('addBalanceModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  
  // إعادة تعيين الحقول
  document.getElementById('balanceAmount').value = '';
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.classList.remove('border-indigo-500');
    btn.classList.add('border-gray-700');
  });
  document.getElementById('proceedPaymentBtn').disabled = true;
  document.getElementById('proceedPaymentBtn').classList.remove('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500');
  document.getElementById('proceedPaymentBtn').classList.add('bg-gray-600', 'cursor-not-allowed');
  
  selectedPaymentMethod = null;
}
    
    function closeAddBalanceModal() {
      document.getElementById('addBalanceModal').classList.add('hidden');
      document.getElementById('addBalanceModal').classList.remove('flex');
    }
    
    function selectPayment(method) {
      selectedPaymentMethod = method;
      
      document.querySelectorAll('.payment-btn').forEach(btn => {
        if (btn.dataset.method === method) {
          btn.classList.remove('border-gray-700');
          btn.classList.add('border-indigo-500');
        } else {
          btn.classList.remove('border-indigo-500');
          btn.classList.add('border-gray-700');
        }
      });
      
      const amount = document.getElementById('balanceAmount').value;
      if (amount && parseInt(amount) >= 100) {
        document.getElementById('proceedPaymentBtn').disabled = false;
        document.getElementById('proceedPaymentBtn').className = 'w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold hover:opacity-90 transition-all cursor-pointer';
      }
    }
    
    function proceedPayment() {
      const amount = parseInt(document.getElementById('balanceAmount').value);
      
      if (!amount || amount < 100) {
        showToast('الحد الأدنى للشحن 100 ج.س', 'error');
        return;
      }
      
      if (!selectedPaymentMethod) {
        showToast('يرجى اختيار طريقة الدفع', 'error');
        return;
      }
      
      document.getElementById('balanceStep1').classList.add('hidden');
      document.getElementById('balanceStep2').classList.remove('hidden');
      
      if (selectedPaymentMethod === 'bankak') {
        document.getElementById('paymentInstructions').textContent = 'الرجاء التحويل إلى الحساب التالي ثم إرسال إشعار عبر واتساب';
        document.getElementById('accountNumber').textContent = '5282457';
        document.getElementById('accountName').textContent = 'تاج السر عبد الباقي محمد الحسن';
      } else {
        document.getElementById('paymentInstructions').textContent = 'الرجاء التحويل إلى الحساب التالي ثم إرسال إشعار عبر واتساب';
        document.getElementById('accountNumber').textContent = '1234567';
        document.getElementById('accountName').textContent = 'تاج السر عبد الباقي محمد';
      }
      
      document.getElementById('transferAmount').textContent = `${amount.toLocaleString()} ج.س`;
    }
    
    function backToStep1() {
      document.getElementById('balanceStep1').classList.remove('hidden');
      document.getElementById('balanceStep2').classList.add('hidden');
    }
    
    function copyAccountNumber() {
      const accountNumber = document.getElementById('accountNumber').textContent;
      navigator.clipboard.writeText(accountNumber);
      showToast('تم نسخ رقم الحساب', 'success');
    }
    
    async function sendWhatsAppNotification() {
      const amount = document.getElementById('balanceAmount').value;
      const paymentMethod = selectedPaymentMethod === 'bankak' ? 'بنكك' : 'ماي كاشي';
      
      // Save order to Firebase
      const order = {
        type: 'balance',
        title: `شحن محفظة - ${paymentMethod}`,
        amount: parseInt(amount),
        paymentMethod: selectedPaymentMethod,
        status: 'pending',
        createdAt: Date.now(),
        estimatedTime: '2-5 دقائق'
      };
      
      const orderId = await pushToFirebase(`orders/${currentUser.id}`, order);
      orders.push({ id: orderId, ...order });
      
      // Add notification
      const notification = {
        message: `تم استلام طلب شحن المحفظة بقيمة ${amount} ج.س`,
        timestamp: Date.now()
      };
      await pushToFirebase(`notifications/${currentUser.id}`, notification);
      notifications.push(notification);
      
      updateUI();
      
      // Create WhatsApp message
      const message = `🎮 *طلب شحن محفظة جديد*
      
👤 الاسم: ${currentUser.name}
🆔 ID: ${currentUser.id}
💰 المبلغ: ${amount} ج.س
💳 طريقة الدفع: ${paymentMethod}
📱 رقم الهاتف: ${currentUser.phone}

⏰ الوقت: ${new Date().toLocaleString('ar-SA')}`;
      
      const whatsappUrl = `https://wa.me/249117449607?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      closeAddBalanceModal();
      showToast('تم إرسال الطلب! يرجى إكمال الدفع عبر واتساب', 'success');
    }
    
    // ================== Orders ==================
    function showMyOrders() {
      if (!currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
      }
      
      renderOrdersList('all');
      document.getElementById('ordersModal').classList.remove('hidden');
    }
    
    function closeOrdersModal() {
      document.getElementById('ordersModal').classList.add('hidden');
    }
    
    function filterOrders(filter) {
      document.querySelectorAll('.order-filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
          btn.classList.remove('bg-[#1a1a2e]');
          btn.classList.add('bg-indigo-500');
        } else {
          btn.classList.remove('bg-indigo-500');
          btn.classList.add('bg-[#1a1a2e]');
        }
      });
      
      renderOrdersList(filter);
    }
    
    function renderOrdersList(filter) {
      const container = document.getElementById('ordersList');
      let filteredOrders = orders;
      
      if (filter !== 'all') {
        filteredOrders = orders.filter(o => o.status === filter);
      }
      
      if (filteredOrders.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">لا توجد طلبات</p>';
        return;
      }
      
      container.innerHTML = filteredOrders.reverse().map(order => `
        <div class="glass-card rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl">${order.type === 'balance' ? '💳' : '🎮'}</span>
              <div>
                <p class="font-bold">${order.title}</p>
                <p class="text-xs text-gray-400">${formatTime(order.createdAt)}</p>
              </div>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}">${getStatusText(order.status)}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-400">المبلغ: <span class="text-white font-bold">${order.amount.toLocaleString()} ج.س</span></span>
            ${order.status === 'pending' ? `<span class="text-yellow-400">⏱️ ${order.estimatedTime}</span>` : ''}
          </div>
        </div>
      `).join('');
    }
    
    // ================== Settings ==================
    function showSettings() {
      if (!currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
      }
      
      document.getElementById('settingsName').value = currentUser.name;
      document.getElementById('settingsPhone').value = currentUser.phone;
      document.getElementById('settingsPassword').value = '';
      
      // Check name change eligibility
      const lastChange = currentUser.lastNameChange || 0;
      const daysSinceChange = (Date.now() - lastChange) / (1000 * 60 * 60 * 24);
      
      if (daysSinceChange < 30) {
        const daysLeft = Math.ceil(30 - daysSinceChange);
        document.getElementById('nameChangeInfo').textContent = `(متاح بعد ${daysLeft} يوم)`;
        document.getElementById('settingsName').disabled = true;
      } else {
        document.getElementById('nameChangeInfo').textContent = '';
        document.getElementById('settingsName').disabled = false;
      }
      
      document.getElementById('settingsModal').classList.remove('hidden');
      document.getElementById('settingsModal').classList.add('flex');
    }
    
    function closeSettingsModal() {
      document.getElementById('settingsModal').classList.add('hidden');
      document.getElementById('settingsModal').classList.remove('flex');
    }
    
    // ================== Support ==================
    function showSupport() {
      document.getElementById('supportContent').classList.remove('hidden');
      document.getElementById('liveChatContainer').classList.add('hidden');
      document.getElementById('supportModal').classList.remove('hidden');
      
    }
    
    function closeSupportModal() {
      document.getElementById('supportModal').classList.add('hidden');
      stopChatTimer();
    }
    
    function toggleFAQ(element) {
      const answer = element.querySelector('.faq-answer');
      const icon = element.querySelector('svg');
      
      answer.classList.toggle('hidden');
      icon.classList.toggle('rotate-180');
    }
    
    function startLiveChat() {
      if (!currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        closeSupportModal();
        showAuthModal('login');
        return;
      }
      
      document.getElementById('supportContent').classList.add('hidden');
      document.getElementById('liveChatContainer').classList.remove('hidden');
      
      // Reset chat
      document.getElementById('chatMessages').innerHTML = `
        <div class="text-center">
          <div class="typing-indicator inline-flex p-3 bg-[#1a1a2e] rounded-xl mb-2">
            <span></span><span></span><span></span>
          </div>
          <p class="text-sm text-gray-500">جاري الاتصال بفريق الدعم...</p>
          <p class="text-xs text-gray-600 mt-1">مدة الانتظار المتوقعة: 5 دقائق</p>
        </div>
      `;
      
      // Start timer
      chatSeconds = 0;
      startChatTimer();
      
      // Simulate agent joining after random time (10-30 seconds)
      setTimeout(() => {
        document.getElementById('chatStatus').textContent = 'متصل';
        document.getElementById('chatStatus').className = 'text-xs text-green-400';
        
        addChatMessage('مرحباً! أنا أحمد من فريق الدعم. كيف يمكنني مساعدتك اليوم؟', 'support');
      }, Math.random() * 20000 + 10000);
    }
    
    function startChatTimer() {
      chatTimer = setInterval(() => {
        chatSeconds++;
        const mins = Math.floor(chatSeconds / 60).toString().padStart(2, '0');
        const secs = (chatSeconds % 60).toString().padStart(2, '0');
        document.getElementById('chatTimer').textContent = `${mins}:${secs}`;
        
        // End session after 5 minutes of waiting
        if (chatSeconds >= 300 && document.getElementById('chatStatus').textContent === 'في انتظار موظف...') {
          addChatMessage('عذراً، لم نتمكن من الاتصال بموظف حالياً. يرجى المحاولة لاحقاً أو التواصل عبر واتساب.', 'system');
          stopChatTimer();
        }
      }, 1000);
    }
    
    function stopChatTimer() {
      if (chatTimer) {
        clearInterval(chatTimer);
        chatTimer = null;
      }
    }
    
    function addChatMessage(text, type) {
      const container = document.getElementById('chatMessages');
      
      // Remove waiting message if exists
      const waitingMsg = container.querySelector('.text-center');
      if (waitingMsg) waitingMsg.remove();
      
      const messageClass = type === 'user' 
        ? 'bg-indigo-500 mr-auto' 
        : type === 'support' 
        ? 'bg-[#1a1a2e] ml-auto' 
        : 'bg-yellow-500/20 text-yellow-400 mx-auto text-center';
      
      container.innerHTML += `
        <div class="max-w-[80%] p-3 rounded-xl ${messageClass}">
          ${type === 'support' ? '<p class="text-xs text-indigo-400 mb-1">فريق الدعم</p>' : ''}
          <p class="text-sm">${text}</p>
        </div>
      `;
      
      container.scrollTop = container.scrollHeight;
    }
    
    function sendChatMessage() {
      const input = document.getElementById('chatInput');
      const message = input.value.trim();
      
      if (!message) return;
      
      addChatMessage(message, 'user');
      input.value = '';
      
      // Simulate response after 2-5 seconds
      setTimeout(() => {
        const responses = [
          'شكراً لتواصلك معنا. سأقوم بمراجعة طلبك.',
          'تم استلام رسالتك. هل يمكنك توضيح المشكلة أكثر؟',
          'أفهم مشكلتك. دعني أتحقق من ذلك.',
          'سأقوم بمساعدتك في حل هذه المشكلة.',
          'هل يمكنك إرسال معرف الطلب أو تفاصيل أكثر؟'
        ];
        
        addChatMessage(responses[Math.floor(Math.random() * responses.length)], 'support');
      }, Math.random() * 3000 + 2000);
    }
    
    function minimizeChat() {
      document.getElementById('supportModal').classList.add('hidden');
      document.getElementById('chatBubble').classList.remove('hidden');
      isChatMinimized = true;
    }
    
    function maximizeChat() {
      document.getElementById('chatBubble').classList.add('hidden');
      document.getElementById('supportModal').classList.remove('hidden');
      isChatMinimized = false;
    }
    
    function toggleFullscreenChat() {
      const modal = document.getElementById('supportModal').querySelector('.glass-card');
      
      if (isChatFullscreen) {
        modal.classList.remove('fixed', 'inset-0', 'rounded-none', 'm-0', 'max-w-none');
        modal.classList.add('rounded-2xl', 'max-w-2xl');
        document.getElementById('chatMessages').classList.remove('h-[calc(100%-200px)]');
        document.getElementById('chatMessages').classList.add('h-80');
      } else {
        modal.classList.add('fixed', 'inset-0', 'rounded-none', 'm-0', 'max-w-none');
        modal.classList.remove('rounded-2xl', 'max-w-2xl');
        document.getElementById('chatMessages').classList.add('h-[calc(100%-200px)]');
        document.getElementById('chatMessages').classList.remove('h-80');
      }
      
      isChatFullscreen = !isChatFullscreen;
    }
    
    // ================== P2P ==================
    async function loadP2PListings() {
      const listings = await getFromFirebase('p2p_listings');
      
      if (listings) {
        p2pListings = Object.entries(listings)
          .map(([id, listing]) => ({ id, ...listing }))
          .filter(l => l.status === 'available');
      }
      
      renderP2PListings();
    }
    // ================== نظام الدردشة المباشرة ==================
let currentChatId = null;
let chatListener = null;

async function startLiveChat() {
  if (!currentUser) {
    showToast('يجب تسجيل الدخول أولاً', 'error');
    closeSupportModal();
    showAuthModal('login');
    return;
  }
  
  // إنشاء محادثة جديدة
  currentChatId = await createNewChat();
  
  if (!currentChatId) {
    showToast('حدث خطأ في بدء المحادثة', 'error');
    return;
  }
  
  // تحديث واجهة الدردشة
  document.getElementById('supportContent').classList.add('hidden');
  document.getElementById('liveChatContainer').classList.remove('hidden');
  
  document.getElementById('chatStatus').textContent = 'في انتظار المشرف...';
  document.getElementById('chatStatus').className = 'text-xs text-yellow-400';
  
  // إضافة رسالة ترحيبية
  document.getElementById('chatMessages').innerHTML = `
        <div class="max-w-[80%] p-3 rounded-xl bg-[#1a1a2e] ml-auto">
            <p class="text-xs text-indigo-400 mb-1">فريق الدعم</p>
            <p class="text-sm">مرحباً بك في خدمة الدعم الفني. يرجى الانتظار حتى يتصل بك أحد مشرفينا.</p>
        </div>
    `;
  
  // إرسال إشعار للمشرفين
  await sendAdminNotification();
  
  // بدء الاستماع للرسائل
  setupChatListener();
  
  // بدء المؤقت
  chatSeconds = 0;
  startChatTimer();
}

async function createNewChat() {
  try {
    const chatData = {
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      status: 'waiting',
      createdAt: Date.now(),
      lastMessage: Date.now(),
      messages: []
    };
    
    const chatId = await pushToFirebase('support_chats', chatData);
    return chatId;
    
  } catch (error) {
    console.error('Error creating chat:', error);
    return null;
  }
}

function setupChatListener() {
  if (!currentChatId) return;
  
  // إزالة المستمع القديم إذا كان موجوداً
  if (chatListener) {
    chatListener();
  }
  
  // الاستماع للرسائل الجديدة
  const chatRef = window.firebaseRef(window.firebaseDB, `support_chats/${currentChatId}/messages`);
  chatListener = window.firebaseOnValue(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      const messages = snapshot.val();
      updateChatMessages(messages);
    }
  });
  
  // الاستماع لتغييرات حالة المحادثة
  const statusRef = window.firebaseRef(window.firebaseDB, `support_chats/${currentChatId}/status`);
  window.firebaseOnValue(statusRef, (snapshot) => {
    if (snapshot.exists()) {
      const status = snapshot.val();
      updateChatStatus(status);
    }
  });
}

function updateChatMessages(messages) {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  
  if (!messages) return;
  
  // تحويل messages إلى مصفوفة وترتيبها حسب الوقت
  const messagesArray = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);
  
  messagesArray.forEach(message => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `max-w-[80%] p-3 rounded-xl mb-2 ${
            message.senderType === 'admin' 
                ? 'bg-[#1a1a2e] ml-auto' 
                : 'bg-indigo-500 mr-auto'
        }`;
    
    messageDiv.innerHTML = `
            ${message.senderType === 'admin' ? '<p class="text-xs text-indigo-400 mb-1">فريق الدعم</p>' : ''}
            <p class="text-sm">${message.text}</p>
            <p class="text-xs text-gray-500 mt-1 text-left">${formatTime(message.timestamp)}</p>
        `;
    
    container.appendChild(messageDiv);
  });
  
  container.scrollTop = container.scrollHeight;
}

function updateChatStatus(status) {
  const statusElement = document.getElementById('chatStatus');
  
  switch (status) {
    case 'connected':
      statusElement.textContent = 'متصل بالمشرف';
      statusElement.className = 'text-xs text-green-400';
      break;
    case 'closed':
      statusElement.textContent = 'تم إنهاء المحادثة';
      statusElement.className = 'text-xs text-gray-400';
      document.getElementById('chatInput').disabled = true;
      break;
    default:
      statusElement.textContent = 'في انتظار المشرف...';
      statusElement.className = 'text-xs text-yellow-400';
  }
}

async function sendChatMessage() {
  if (!currentChatId) {
    showToast('لم يتم بدء المحادثة بعد', 'error');
    return;
  }
  
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  try {
    // إرسال الرسالة
    await pushToFirebase(`support_chats/${currentChatId}/messages`, {
      text: message,
      senderId: currentUser.id,
      senderType: 'user',
      timestamp: Date.now(),
      read: false
    });
    
    // تحديث آخر رسالة في المحادثة
    await window.firebaseUpdate(window.firebaseRef(window.firebaseDB, `support_chats/${currentChatId}`), {
      lastMessage: Date.now(),
      status: 'active'
    });
    
    input.value = '';
    
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('حدث خطأ في إرسال الرسالة', 'error');
  }
}

async function sendAdminNotification() {
  try {
    const notification = {
      type: 'support',
      message: `طلب دعم جديد من ${currentUser.name}`,
      userId: currentUser.id,
      chatId: currentChatId,
      timestamp: Date.now(),
      read: false
    };
    
    await pushToFirebase('admin_notifications', notification);
    
  } catch (error) {
    console.error('Error sending admin notification:', error);
  }
}

// تعديل دالة minimizeChat
function minimizeChat() {
  if (currentChatId) {
    document.getElementById('supportModal').classList.add('hidden');
    document.getElementById('chatBubble').classList.remove('hidden');
    isChatMinimized = true;
  }
}

function maximizeChat() {
  document.getElementById('chatBubble').classList.add('hidden');
  document.getElementById('supportModal').classList.remove('hidden');
  isChatMinimized = false;
}
    function renderP2PListings() {
      const container = document.getElementById('p2pListings');
      
      if (p2pListings.length === 0) {
        container.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-8">لا توجد حسابات متاحة حالياً</p>';
        return;
      }
      
      const gameIcons = {
        'pubg': '🔫',
        'freefire': '🔥',
        'fortnite': '🎯',
        'cod': '💀',
        'genshin': '⭐'
      };
      
      const gameNames = {
        'pubg': 'PUBG Mobile',
        'freefire': 'Free Fire',
        'fortnite': 'Fortnite',
        'cod': 'Call of Duty Mobile',
        'genshin': 'Genshin Impact'
      };
      
      container.innerHTML = p2pListings.map(listing => `
        <div class="glass-card rounded-xl p-4">
          <div class="flex items-start gap-3 mb-3">
            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span class="text-2xl">${gameIcons[listing.game] || '🎮'}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate">${listing.title}</p>
              <p class="text-xs text-gray-400">${gameNames[listing.game] || listing.game}</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3 line-clamp-2">${listing.description}</p>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500">البائع: ${listing.sellerName}</p>
              <p class="font-black gradient-text">${listing.price.toLocaleString()} ج.س</p>
            </div>
            <button onclick="buyP2PAccount('${listing.id}')" class="px-4 py-2 bg-indigo-500 rounded-lg text-sm font-medium hover:bg-indigo-600 transition-all">
              شراء
            </button>
          </div>
        </div>
      `).join('');
    }
    
    function showP2P() {
      document.getElementById('p2pModal').classList.remove('hidden');
      loadP2PListings();
    }
    
    function closeP2PModal() {
      document.getElementById('p2pModal').classList.add('hidden');
    }
    
    function switchP2PTab(tab) {
      document.querySelectorAll('.p2p-tab').forEach(btn => {
        if (btn.dataset.tab === tab) {
          btn.classList.remove('bg-[#1a1a2e]');
          btn.classList.add('bg-indigo-500');
        } else {
          btn.classList.remove('bg-indigo-500');
          btn.classList.add('bg-[#1a1a2e]');
        }
      });
      
      document.querySelectorAll('.p2p-content').forEach(content => {
        content.classList.add('hidden');
      });
      
      document.getElementById(`p2p${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).classList.remove('hidden');
    }
    
    async function buyP2PAccount(listingId) {
      if (!currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        closeP2PModal();
        showAuthModal('login');
        return;
      }
      
      const listing = p2pListings.find(l => l.id === listingId);
      if (!listing) return;
      
      if (listing.sellerId === currentUser.id) {
        showToast('لا يمكنك شراء حسابك الخاص', 'error');
        return;
      }
      
      if ((currentUser.balance || 0) < listing.price) {
        showToast('رصيدك غير كافي', 'error');
        return;
      }
      
      // Create P2P transaction
      const transaction = {
        listingId,
        buyerId: currentUser.id,
        buyerName: currentUser.name,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        title: listing.title,
        game: listing.game,
        price: listing.price,
        status: 'escrow', // المبلغ محجوز
        createdAt: Date.now()
      };
      
      // Deduct balance (escrow)
      const newBalance = (currentUser.balance || 0) - listing.price;
      await window.firebaseUpdate(window.firebaseRef(window.firebaseDB, `users/${currentUser.id}`), { balance: newBalance });
      currentUser.balance = newBalance;
      localStorage.setItem('blackstore_user', JSON.stringify(currentUser));
      
      // Update listing status
      await window.firebaseUpdate(window.firebaseRef(window.firebaseDB, `p2p_listings/${listingId}`), { status: 'pending' });
      
      // Save transaction
      await pushToFirebase('p2p_transactions', transaction);
      
      // Notify seller
      await pushToFirebase(`notifications/${listing.sellerId}`, {
        message: `لديك طلب شراء جديد لحسابك: ${listing.title}`,
        timestamp: Date.now()
      });
      
      updateUI();
      await loadP2PListings();
      
      showToast('تم حجز المبلغ! يرجى انتظار البائع لتسليم بيانات الحساب', 'success');
    }
    
    // ================== Notifications ==================
    function showAllNotifications() {
      const container = document.getElementById('allNotifications');
      
      if (notifications.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">لا توجد إشعارات</p>';
      } else {
        container.innerHTML = notifications.reverse().map(notif => `
          <div class="glass-card rounded-xl p-4">
            <p class="text-sm">${notif.message}</p>
            <p class="text-xs text-gray-500 mt-2">${formatTime(notif.timestamp)}</p>
          </div>
        `).join('');
      }
      
      document.getElementById('notificationsModal').classList.remove('hidden');
    }
    
    function closeNotificationsModal() {
      document.getElementById('notificationsModal').classList.add('hidden');
    }
    
    // ================== Utilities ==================
    function copyUserId() {
      if (!currentUser) return;
      navigator.clipboard.writeText(currentUser.id);
      showToast('تم نسخ المعرف', 'success');
    }
    
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      
      const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-indigo-500';
      
      toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 fade-in max-w-sm`;
      toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-2 hover:opacity-70">✕</button>
      `;
      
      container.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 5000);
    }
    
    // Search functionality
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      
      if (!query) {
        renderGames();
        return;
      }
      
      const filtered = games.filter(g => g.name.toLowerCase().includes(query));
      const container = document.getElementById('gamesGrid');
      
      if (filtered.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">لم يتم العثور على نتائج</p>';
        return;
      }
      
      container.innerHTML = filtered.map(game => `
        <div class="game-card glass-card rounded-xl p-4 cursor-pointer" onclick="openGameModal('${game.id}')">
          <div class="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-3">
            <span class="text-3xl">${game.icon}</span>
          </div>
          <h3 class="text-center font-bold text-sm">${game.name}</h3>
          <p class="text-center text-xs text-gray-400 mt-1">${game.offers?.length || 0} عروض</p>
        </div>
      `).join('');
    });
  