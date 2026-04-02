import type {
    AnalyzeCommitsContext,
    Config,
    GenerateNotesContext,
    PrepareContext,
    PublishContext,
    VerifyConditionsContext,
} from 'semantic-release'
import type { SemanticConfigType } from 'semantic-release/lib/get-config.js'

import { modifyContextCommits, modifyContextReleaseVersion, synchronizeWorkspaceDependencies, updateLockfile } from './utils.js'

export function createInlinePlugin(semanticConfig: SemanticConfigType) {
    // biome-ignore lint/suspicious/useAwait: semantic-release expect steps to return Promise
    const verifyConditions = async (_: Config, context: VerifyConditionsContext) => {
        context.logger.log(`[@algofam/package-releaser]: Starting verifyConditions for ${context.cwd}`)
        return semanticConfig.plugins.verifyConditions(modifyContextCommits(context as any, semanticConfig))
    }

    // biome-ignore lint/suspicious/useAwait: semantic-release expect steps to return Promise
    const analyzeCommits = async (_: Config, context: AnalyzeCommitsContext) => {
        return semanticConfig.plugins.analyzeCommits(modifyContextCommits(context, semanticConfig))
    }

    // biome-ignore lint/suspicious/useAwait: semantic-release expect steps to return Promise
    const generateNotes = async (_: Config, context: GenerateNotesContext) => {
        return semanticConfig.plugins.generateNotes(
            modifyContextCommits(modifyContextReleaseVersion(context), semanticConfig),
        )
    }

    // biome-ignore lint/suspicious/useAwait: semantic-release expect steps to return Promise
    const prepare = async (_: Config, context: PrepareContext) => {
        context.logger.log(`[@algofam/package-releaser]: Starting prepare for ${context.cwd}`)
        if (context.cwd) {
            synchronizeWorkspaceDependencies(context.cwd)
        }
        const result = await semanticConfig.plugins.prepare(modifyContextCommits(context, semanticConfig))
        updateLockfile()
        return result
    }

    const publish = async (_: Config, context: PublishContext) => {
        context.logger.log(`[@algofam/package-releaser]: Starting publish for ${context.cwd}`)
        const [response] = await semanticConfig.plugins.publish(modifyContextCommits(context, semanticConfig))

        return response ?? {}
    }

    const inlinePlugin = {
        verifyConditions,
        analyzeCommits,
        generateNotes,
        prepare,
        publish,
    }

    for (const value of Object.values(inlinePlugin)) {
        Reflect.defineProperty(value, 'pluginName', {
            enumerable: true,
            value: '@algofam/package-releaser-inline-plugin',
            writable: false,
        })
    }

    return inlinePlugin
}