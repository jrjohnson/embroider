import { Resolver } from './resolver';
import { join } from 'path';
import { PluginItem, transform } from '@babel/core';
import type { Params as InlineBabelParams } from './babel-plugin-inline-hbs';
import { Plugins } from './ember-template-compiler-types';
import { getEmberExports } from './load-ember-template-compiler';
import { TemplateCompiler } from './template-compiler-common';
import adjustImportsPlugin from './babel-plugin-adjust-imports';

export interface NodeTemplateCompilerParams {
  compilerPath: string;
  compilerChecksum: string;
  resolver?: Resolver;
  EmberENV: unknown;
  plugins: Plugins;
}

export class NodeTemplateCompiler extends TemplateCompiler {
  constructor(public params: NodeTemplateCompilerParams) {
    super({
      loadEmberTemplateCompiler: () => getEmberExports(params.compilerPath),
      resolver: params.resolver,
      EmberENV: params.EmberENV,
      plugins: params.plugins,
    });
  }

  compile(moduleName: string, contents: string) {
    let src = super.compile(moduleName, contents);
    let resolver = this.params.resolver;
    if (resolver) {
      return transform(src, {
        filename: moduleName,
        generatorOpts: {
          compact: false,
        },
        plugins: [[adjustImportsPlugin, resolver.adjustImportsOptions]],
      })!.code!;
    } else {
      return src;
    }
  }

  // Use applyTransforms on the contents of inline hbs template strings inside
  // Javascript.
  inlineTransformsBabelPlugin(): PluginItem {
    return [
      join(__dirname, 'babel-plugin-inline-hbs-node.js'),
      {
        templateCompiler: this.params,
        stage: 1,
      } as InlineBabelParams,
    ];
  }

  baseDir() {
    return join(__dirname, '..');
  }

  // tests for the classic ember-cli-htmlbars-inline-precompile babel plugin
  static isInlinePrecompilePlugin(item: PluginItem) {
    if (typeof item === 'string') {
      return matchesSourceFile(item);
    }
    if (hasProperties(item) && (item as any)._parallelBabel) {
      return matchesSourceFile((item as any)._parallelBabel.requireFile);
    }
    if (Array.isArray(item) && item.length > 0) {
      if (typeof item[0] === 'string') {
        return matchesSourceFile(item[0]);
      }
      if (hasProperties(item[0]) && (item[0] as any)._parallelBabel) {
        return matchesSourceFile((item[0] as any)._parallelBabel.requireFile);
      }
    }
    return false;
  }
}

function matchesSourceFile(filename: string) {
  return /(htmlbars-inline-precompile|ember-cli-htmlbars)\/(index|lib\/require-from-worker)(\.js)?$/.test(filename);
}

function hasProperties(item: any) {
  return item && (typeof item === 'object' || typeof item === 'function');
}
