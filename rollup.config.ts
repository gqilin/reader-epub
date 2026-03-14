import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import { defineConfig } from 'rollup';

const external = ['jszip'];

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/xml-ebook.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/xml-ebook.cjs.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/xml-ebook.umd.js',
        format: 'umd',
        name: 'XmlEbook',
        sourcemap: true,
        globals: { jszip: 'JSZip' },
      },
    ],
    external,
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser({
        output: { comments: false },
        compress: { passes: 2 },
      }),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xml-ebook.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
]);
