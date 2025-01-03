const fs = require('fs');
const md = require('markdown-it')();
const mermaid = require('markdown-it-mermaid').default;

md.use(mermaid);

const input = process.argv[2];
const output = process.argv[3] || 'output.html';

const markdown = fs.readFileSync(input, 'utf8');
const result = md.render(markdown);

fs.writeFileSync(output, `
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

console.log(`Output written to ${output}`);
