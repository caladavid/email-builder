import "./assets/main.css";
import "./assets/markdown-reset.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import ui from "@nuxt/ui/vue-plugin";

import App from "./App.vue";

const app = createApp(App);

app.use(ui);
app.use(createPinia());


app.mount("#app");
