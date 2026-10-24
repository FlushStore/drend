import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import escalaDesktop from "./scripts/postcss-escala-desktop.js";

// Mesma regra de proporção do painel da Flush: no PC com mouse tudo fica a 87,5%.
export default { plugins: [tailwindcss(), escalaDesktop(), autoprefixer()] };
