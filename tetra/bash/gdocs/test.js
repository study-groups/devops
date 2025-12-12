/**
 * Test script for gdoc-addr library
 * Run with: node test.js
 */

const GDocAddr = require('./gdoc-addr.js');

// Sample Google Doc JSON (copied from a real document)
const sampleDoc = {
  "title": "Test Document for gdoc-addr",
  "documentId": "1FGqgoLGBxX3ubdATj5rvdRv5CBQuR4ztwrfDlOUTQOw",
  "body": {
    "content": [
      {
        "endIndex": 1,
        "sectionBreak": {}
      },
      {
        "startIndex": 1,
        "endIndex": 25,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Chapter 1: Introduction\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 26,
        "endIndex": 157,
        "paragraph": {
          "elements": [{ "textRun": { "content": "This is the introduction paragraph. It contains multiple sentences. Here is the second sentence. And a third one for good measure.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 158,
        "endIndex": 182,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Section 1.1: Background\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 183,
        "endIndex": 293,
        "paragraph": {
          "elements": [{ "textRun": { "content": "The background section provides context. Dr. Smith discovered this in 1995. The research continued for years.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 294,
        "endIndex": 318,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Section 1.2: Motivation\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 319,
        "endIndex": 449,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Why does this matter? It matters because of several reasons. First, it advances the field. Second, it has practical applications.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 450,
        "endIndex": 469,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Chapter 2: Methods\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 470,
        "endIndex": 538,
        "paragraph": {
          "elements": [{ "textRun": { "content": "This chapter describes the methodology. We used various approaches.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 539,
        "endIndex": 568,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Section 2.1: Data Collection\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 569,
        "endIndex": 691,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Data was collected from multiple sources. The process took approximately 3.5 months. Each sample was carefully validated.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 692,
        "endIndex": 714,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Section 2.2: Analysis\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 715,
        "endIndex": 813,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Analysis was performed using standard techniques. Results were verified by independent reviewers.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 814,
        "endIndex": 836,
        "paragraph": {
          "elements": [{ "textRun": { "content": "Chapter 3: Conclusion\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      },
      {
        "startIndex": 837,
        "endIndex": 943,
        "paragraph": {
          "elements": [{ "textRun": { "content": "In conclusion, this work demonstrates important findings. Future research should expand on these results.\n" } }],
          "paragraphStyle": { "namedStyleType": "NORMAL_TEXT" }
        }
      }
    ]
  }
};

console.log('=== Testing gdoc-addr library ===\n');

// Parse document
console.log('1. Parsing document...');
const tree = GDocAddr.parse(sampleDoc);
console.log(`   Title: ${tree.title}`);
console.log(`   Paragraphs: ${tree.flatParagraphs.length}`);
console.log(`   Sentences: ${tree.flatSentences.length}`);

// Table of contents
console.log('\n2. Table of Contents:');
const toc = GDocAddr.toc(tree);
for (const item of toc) {
  const indent = '   '.repeat(item.depth + 1);
  console.log(`${indent}[${item.address}] ${item.title}`);
}

// Address resolution
console.log('\n3. Address Resolution:');

const tests = [
  'c1',           // Chapter 1
  'c1p1',         // Chapter 1, paragraph 1
  'c1p1sent1',    // Chapter 1, paragraph 1, sentence 1
  'c1p1sent2',    // Chapter 1, paragraph 1, sentence 2
  'c1s1',         // Chapter 1, section 1
  'c1s1p1',       // Chapter 1, section 1, paragraph 1
  'c2',           // Chapter 2
  'c2s1p1sent2',  // Chapter 2, section 1, paragraph 1, sentence 2
  'c3p1',         // Chapter 3, paragraph 1
];

for (const addr of tests) {
  const result = GDocAddr.get(tree, addr);
  if (result) {
    const content = typeof result.content === 'string'
      ? result.content.substring(0, 60) + (result.content.length > 60 ? '...' : '')
      : '[multiple results]';
    console.log(`   ${addr} => ${content}`);
  } else {
    console.log(`   ${addr} => (not found)`);
  }
}

// Verbose address format
console.log('\n4. Verbose Address Format:');
const verboseResult = GDocAddr.get(tree, 'chapter:1/section:1/para:1');
console.log(`   chapter:1/section:1/para:1 => ${verboseResult?.content?.substring(0, 50)}...`);

// Find text
console.log('\n5. Find "Smith":');
const findResults = GDocAddr.find(tree, 'Smith');
for (const result of findResults) {
  console.log(`   [${result.address}] ${result.content.substring(0, 50)}...`);
}

// Sentence splitting test
console.log('\n6. Sentence Splitting (handling abbreviations):');
const testSentences = GDocAddr.splitSentences(
  "Dr. Smith discovered this in 1995. The value was 3.5 approximately. What happened next?"
);
for (let i = 0; i < testSentences.length; i++) {
  console.log(`   Sentence ${i + 1}: ${testSentences[i]}`);
}

console.log('\n=== All tests complete ===');
