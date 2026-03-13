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
        file: 'dist/epub-reader.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/epub-reader.cjs.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/epub-reader.umd.js',
        format: 'umd',
        name: 'EpubReader',
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
      file: 'dist/epub-reader.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
]);
