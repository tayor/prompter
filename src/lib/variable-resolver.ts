/**
 * Variable Resolver Library
 * Handles {{variable}} substitution in prompt content
 */

// Regex pattern to match {{variable}} or {{namespace.variable}}
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g

/**
 * Extract all variable names from content
 * @param content - The prompt content with {{variables}}
 * @returns Array of unique variable names
 */
export function extractVariables(content: string): string[] {
    const variables = new Set<string>()
    let match

    while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
        variables.add(match[1].trim())
    }

    // Reset regex lastIndex for subsequent calls
    VARIABLE_PATTERN.lastIndex = 0

    return Array.from(variables)
}

/**
 * Resolve variables in content by substituting values
 * @param content - The prompt content with {{variables}}
 * @param variables - Object mapping variable names to values
 * @returns Content with variables substituted
 */
export function resolveVariables(
    content: string,
    variables: Record<string, string>
): string {
    return content.replace(VARIABLE_PATTERN, (match, varName) => {
        const trimmedName = varName.trim()

        // Check for dot notation (e.g., input.topic, step1.output)
        const parts = trimmedName.split('.')
        if (parts.length > 1) {
            // Try full path first
            if (variables[trimmedName] !== undefined) {
                return variables[trimmedName]
            }
            // Try just the last part as fallback
            const lastPart = parts[parts.length - 1]
            if (variables[lastPart] !== undefined) {
                return variables[lastPart]
            }
        }

        // Direct variable lookup
        if (variables[trimmedName] !== undefined) {
            return variables[trimmedName]
        }

        // Return original if not found
        return match
    })
}

/**
 * Validate that all required variables are provided
 * @param content - The prompt content with {{variables}}
 * @param provided - Object of provided variable values
 * @returns Validation result with missing variables
 */
export function validateVariables(
    content: string,
    provided: Record<string, string>
): { valid: boolean; missing: string[] } {
    const required = extractVariables(content)
    const missing: string[] = []

    for (const varName of required) {
        const parts = varName.split('.')
        const hasValue =
            provided[varName] !== undefined ||
            (parts.length > 1 && provided[parts[parts.length - 1]] !== undefined)

        if (!hasValue) {
            missing.push(varName)
        }
    }

    return {
        valid: missing.length === 0,
        missing,
    }
}

/**
 * Parse workflow variable references
 * Supports: {{input.varName}}, {{stepN.output}}, {{global.varName}}
 */
export function parseVariableReference(reference: string): {
    namespace: 'input' | 'step' | 'global' | 'direct'
    stepNumber?: number
    variableName: string
} {
    const parts = reference.trim().split('.')

    if (parts.length === 1) {
        return { namespace: 'direct', variableName: parts[0] }
    }

    const [namespace, ...rest] = parts
    const variableName = rest.join('.')

    if (namespace === 'input') {
        return { namespace: 'input', variableName }
    }

    if (namespace === 'global') {
        return { namespace: 'global', variableName }
    }

    // Check for step reference (step1, step2, etc.)
    const stepMatch = namespace.match(/^step(\d+)$/)
    if (stepMatch) {
        return {
            namespace: 'step',
            stepNumber: parseInt(stepMatch[1], 10),
            variableName,
        }
    }

    // Default to treating as direct variable
    return { namespace: 'direct', variableName: reference.trim() }
}

/**
 * Build a context object for workflow execution
 * Combines input variables, step outputs, and global variables
 */
export function buildWorkflowContext(
    inputs: Record<string, string>,
    stepOutputs: Record<number, string>,
    globals?: Record<string, string>
): Record<string, string> {
    const context: Record<string, string> = {}

    // Add input variables with namespace
    for (const [key, value] of Object.entries(inputs)) {
        context[`input.${key}`] = value
        context[key] = value // Also add without namespace for convenience
    }

    // Add step outputs
    for (const [stepNum, output] of Object.entries(stepOutputs)) {
        context[`step${stepNum}.output`] = output
    }

    // Add global variables
    if (globals) {
        for (const [key, value] of Object.entries(globals)) {
            context[`global.${key}`] = value
        }

        // Add common globals
        context['global.date'] = new Date().toISOString().split('T')[0]
        context['global.timestamp'] = new Date().toISOString()
    }

    return context
}

/**
 * Highlight variables in content for display
 * Returns HTML with variables wrapped in spans
 */
export function highlightVariables(content: string): string {
    return content.replace(
        VARIABLE_PATTERN,
        '<span class="variable-highlight">$&</span>'
    )
}
