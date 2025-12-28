import { createApp } from 'vue';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import pinia from './plugins/pinia';
import i18n from './plugins/i18n';
import router from './router';

const app = createApp(App);

app.use(pinia);
app.use(vuetify);
app.use(i18n);
app.use(router);

app.mount('#app');
