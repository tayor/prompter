import assert from 'node:assert/strict'
import test from 'node:test'
import {
    buildWorkflowContext,
    extractVariables,
    highlightVariables,
    parseVariableReference,
    resolveVariables,
    validateVariables,
} from '@/lib/variable-resolver'

test('extractVariables returns unique trimmed variables and resets regex state', () => {
    const first = extractVariables(
        'Hello {{ name }} {{input.topic}} {{ name }} {{step1.output}}'
    )
    assert.deepEqual(first, ['name', 'input.topic', 'step1.output'])

    const second = extractVariables('Second pass {{again}}')
    assert.deepEqual(second, ['again'])
})

test('resolveVariables resolves direct and namespaced variables with fallback', () => {
    const resolved = resolveVariables(
        '{{input.topic}} / {{topic}} / {{step1.output}} / {{missing}} / {{step2.result}}',
        {
            'input.topic': 'AI',
            topic: 'Prompting',
            'step1.output': 'Step Output',
            result: 'Fallback Result',
        }
    )

    assert.equal(
        resolved,
        'AI / Prompting / Step Output / {{missing}} / Fallback Result'
    )
})

test('validateVariables reports missing values by variable name', () => {
    const validation = validateVariables(
        'Use {{input.topic}} and {{tone}} and {{step2.output}}',
        {
            topic: 'AI',
            tone: 'formal',
        }
    )

    assert.equal(validation.valid, false)
    assert.deepEqual(validation.missing, ['step2.output'])
})

test('parseVariableReference supports input, global, step, direct and unknown namespace', () => {
    assert.deepEqual(parseVariableReference('input.topic'), {
        namespace: 'input',
        variableName: 'topic',
    })
    assert.deepEqual(parseVariableReference('global.date'), {
        namespace: 'global',
        variableName: 'date',
    })
    assert.deepEqual(parseVariableReference('step12.output'), {
        namespace: 'step',
        stepNumber: 12,
        variableName: 'output',
    })
    assert.deepEqual(parseVariableReference('title'), {
        namespace: 'direct',
        variableName: 'title',
    })
    assert.deepEqual(parseVariableReference('unknown.path'), {
        namespace: 'direct',
        variableName: 'unknown.path',
    })
})

test('buildWorkflowContext composes namespaced and convenience keys', () => {
    const context = buildWorkflowContext(
        { topic: 'AI', tone: 'casual' },
        { 1: 'draft', 2: 'refined' },
        { locale: 'en-US' }
    )

    assert.equal(context['input.topic'], 'AI')
    assert.equal(context.topic, 'AI')
    assert.equal(context['step1.output'], 'draft')
    assert.equal(context['step2.output'], 'refined')
    assert.equal(context['global.locale'], 'en-US')
    assert.match(context['global.date'], /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(Number.isFinite(Date.parse(context['global.timestamp'])))
})

test('highlightVariables wraps matched variables in span markup', () => {
    const highlighted = highlightVariables('Hello {{name}}')
    assert.equal(
        highlighted,
        'Hello <span class="variable-highlight">{{name}}</span>'
    )
})
