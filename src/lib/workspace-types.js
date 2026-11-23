/**
 * Shared JSDoc contracts for the JavaScript Workspace client.
 * Provider pricing is optional: never infer a rate when metadata is absent.
 *
 * @typedef {"user"|"assistant"|"system"} WorkspaceMessageRole
 *
 * @typedef {Object} WorkspaceMessage
 * @property {string} id
 * @property {WorkspaceMessageRole} role
 * @property {string} content
 * @property {number=} createdAt
 * @property {string=} error
 * @property {string=} parentMessageId
 * @property {string=} branchConversationId
 *
 * @typedef {Object} WorkspaceModelCapabilities
 * @property {boolean=} vision
 * @property {boolean=} tools
 * @property {boolean=} streaming
 * @property {boolean=} file_input
 * @property {boolean=} files
 * @property {boolean=} file_upload
 *
 * @typedef {Object} WorkspaceModel
 * @property {string} id
 * @property {string} provider_code
 * @property {string=} provider_model_id
 * @property {string=} display_name
 * @property {number|null=} context_window
 * @property {WorkspaceModelCapabilities=} capabilities
 * @property {string|null=} pricing_reference
 * @property {"listed"|"unlisted"|"preview"=} catalog_status
 *
 * @typedef {Object} WorkspaceAttachment
 * @property {string} id
 * @property {string} name
 * @property {string} path
 * @property {number} size
 * @property {string} text
 * @property {number} tokens
 *
 * @typedef {Object} WorkspaceMetrics
 * @property {number|null=} ttftMs
 * @property {number|null=} elapsedMs
 * @property {number=} estimatedOutputTokens
 * @property {number=} outputCharacters
 * @property {Object=} usage
 *
 * @typedef {Object} WorkspaceSessionUsage
 * @property {number=} total_input_tokens
 * @property {number=} total_output_tokens
 * @property {number=} request_count
 * @property {number|null=} estimated_cost
 * @property {string=} currency
 * @property {boolean=} usage_estimated
 *
 * @typedef {Object} WorkspaceStoreSnapshot
 * @property {WorkspaceMessage[]} messages
 * @property {string} draft
 * @property {string} activeConversationId
 * @property {WorkspaceModel[]} models
 * @property {string} selectedModelId
 * @property {string[]} favoriteModelIds
 * @property {string[]} recentModelIds
 * @property {WorkspaceAttachment[]} attachments
 * @property {string[]} selectedAttachmentIds
 * @property {WorkspaceMetrics|null} metrics
 * @property {WorkspaceSessionUsage|null} sessionUsage
 * @property {boolean} isStreaming
 * @property {boolean} isModelPickerOpen
 * @property {boolean} isDraggingFiles
 *
 * @typedef {Object} WorkspaceApiError
 * @property {string} message
 * @property {number=} status
 * @property {string=} code
 */

export {};
