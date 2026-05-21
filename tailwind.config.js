/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Aplicamos la fuente de tu diseño
      },
      colors: {
        // TUS COLORES DEL DISEÑO
        brand: {
          primary: '#2C3E50',   // El azul oscuro institucional
          secondary: '#4A90E2', // El celeste brillante
          tertiary: '#7F8C8D',  // El gris
          neutral: '#F4F7F6',   // El fondo claro del admin
        },
        // (Aquí Shadcn dejará sus colores de sistema, los puedes dejar)
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}