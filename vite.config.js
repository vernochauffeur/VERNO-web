import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildFaqSchema } from './src/content/faq.js'

const FAQ_SCHEMA_PLACEHOLDER = '<!-- FAQ_SCHEMA -->'

// Injects the FAQPage structured data into index.html from src/content/faq.js,
// so the SEO FAQ always matches the FAQ shown on the page.
function faqSchemaPlugin() {
  return {
    name: 'verno-faq-schema',
    transformIndexHtml(html) {
      if (!html.includes(FAQ_SCHEMA_PLACEHOLDER)) {
        throw new Error(`index.html is missing the ${FAQ_SCHEMA_PLACEHOLDER} placeholder`)
      }
      const json = JSON.stringify(buildFaqSchema(), null, 2).replace(/</g, '\\u003c')
      return html.replace(
        FAQ_SCHEMA_PLACEHOLDER,
        `<script type="application/ld+json">\n${json}\n    </script>`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), faqSchemaPlugin()],
  test: {
    environment: 'node',
  },
})
