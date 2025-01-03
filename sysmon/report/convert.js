const fs = require('fs');
const markdownIt = require('markdown-it');
const mermaidPlugin = require('markdown-it-mermaid').default;

const md = markdownIt().use(mermaidPlugin);

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'output.html';

if (!inputFile) {
  console.error('Usage: node convert.js <input.md> [output.html]');
  process.exit(1);
}

const markdown = fs.readFileSync(inputFile, 'utf8');
const result = md.render(markdown);

fs.writeFileSync(outputFile, `
  <html>
    <head>
      <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true });
      </script>
    </head>
    <body>${result}</body>
  </html>
`);

console.log(`Output written to ${outputFile}`);
