import { createApp } from 'vue';
import App from './shell/App.vue';
import { router } from './shell/router';

// Import shared demo styles
import '@demo/shared/demo-index.css';
import '@demo/shared/employee-management/demo-styles.css';

createApp(App).use(router).mount('#app');
