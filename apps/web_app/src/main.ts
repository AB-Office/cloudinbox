import { createApp } from 'vue';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import pinia from './plugins/pinia';
import i18n from './plugins/i18n';
import router from './router';
import { useAuthStore } from './stores/auth';

const app = createApp(App);

app.use(pinia);
app.use(vuetify);
app.use(i18n);
app.use(router);

// 認証状態の監視を初期化
const authStore = useAuthStore();
authStore.initializeAuthStateListener();

app.mount('#app');
