import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const production = !process.env.ROLLUP_WATCH;

export default [
  // Main build
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        exports: 'named'
      },
      {
        file: 'dist/index.esm.js',
        format: 'es'
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      production && terser()
    ].filter(Boolean)
  },
  // Lite build
  {
    input: 'src/lite.js',
    output: [
      {
        file: 'dist/lite.js',
        format: 'cjs',
        exports: 'named'
      },
      {
        file: 'dist/lite.esm.js',
        format: 'es'
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      production && terser()
    ].filter(Boolean)
  },
  // TypeScript declarations
  {
    input: 'src/index.d.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  },
  {
    input: 'src/lite.d.ts',
    output: {
      file: 'dist/lite.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
]; 