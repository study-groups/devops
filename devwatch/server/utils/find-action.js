// find-action.js
const fs = require("fs/promises");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

/**
 * Heuristics:
 * - Start at the smallest AST node covering (line).
 * - Climb to the nearest function-like ancestor (closure).
 * - Keep climbing until a predicate "isActionScope" is satisfied.
 * - Exclude logging-only wrappers (name looks like log/debug OR body is only logger calls).
 * - Prefer functions whose identifier/property suggests app semantics: action/handler/route/job/task/command.
 * - Accept explicit hints via @pja.meta(TYPE="ACTION") on the function or its leading comments.
 */
const LIBRARY_INITIALIZATION_PATTERNS = [
    {
        name: 'LIBRARY_SETUP',
        matchers: [
            // Library-specific initialization patterns
            {
                libraries: ['bree', 'winston', 'express', 'mongoose', 'sequelize'],
                checks: [
                    // Check for logger configuration within library setup
                    node => {
                        const isLoggerConfig = 
                            // Check for object with logger-like methods
                            (t.isObjectExpression(node) && 
                                node.properties.some(prop => 
                                    t.isObjectProperty(prop) && 
                                    t.isIdentifier(prop.key) && 
                                    ['info', 'error', 'warn', 'log'].includes(prop.key.name)
                                )
                            ) ||
                            // Check for arrow functions or methods configuring logging
                            (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) &&
                            node.body.body && 
                            node.body.body.some(stmt => 
                                t.isCallExpression(stmt.expression) && 
                                t.isMemberExpression(stmt.expression.callee) && 
                                ['info', 'error', 'warn', 'log'].includes(stmt.expression.callee.property.name)
                            );

                        return isLoggerConfig;
                    }
                ]
            },
            {
                name: 'LIBRARY_LOGGER_SETUP',
                libraries: ['bree', 'winston', 'log4js', 'bunyan'],
                checks: [
                    // Detect logger configuration or transformation
                    node => {
                        const isLoggerSetup = 
                            // Object with logger methods
                            (t.isObjectExpression(node) && 
                                node.properties.some(prop => 
                                    t.isObjectProperty(prop) && 
                                    t.isIdentifier(prop.key) && 
                                    ['info', 'error', 'warn', 'log', 'logger'].includes(prop.key.name)
                                )
                            ) ||
                            // Function transforming logging
                            (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) &&
                            node.body.body && 
                            node.body.body.some(stmt => 
                                t.isCallExpression(stmt.expression) && 
                                (
                                    // Logging method calls
                                    (t.isMemberExpression(stmt.expression.callee) && 
                                        ['info', 'error', 'warn', 'log'].includes(stmt.expression.callee.property.name)) ||
                                    // Direct logger transformations
                                    (t.isIdentifier(stmt.expression.callee) && 
                                        ['configureLogger', 'setupLogger', 'transformLogger'].includes(stmt.expression.callee.name))
                                )
                            );

                        return isLoggerSetup;
                    }
                ]
            }
        ]
    }
];

function identifyLibraryContext(node) {
    for (const pattern of LIBRARY_INITIALIZATION_PATTERNS) {
        for (const libraryPattern of pattern.matchers) {
            // Check if any of the pattern's checks pass
            const matchFound = libraryPattern.checks.some(check => check(node));
            
            if (matchFound) {
                return {
                    type: pattern.name,
                    library: libraryPattern.libraries.join('|'),
                    confidence: 'high'
                };
            }
        }
    }
    return null;
}

async function findEnclosingAction(filePath, line) {
  const abs = path.resolve(filePath);
  const code = await fs.readFile(abs, "utf8");

  const ast = parser.parse(code, {
    sourceType: "unambiguous",
    plugins: [
      "jsx",
      "classProperties",
      "optionalChaining",
      "nullishCoalescingOperator",
      "typescript",
    ],
    errorRecovery: true,
    ranges: false,
    tokens: false,
  });

  let bestPath = null;

  traverse(ast, {
    enter(p) {
      const n = p.node;
      if (!n.loc) return;
      if (n.loc.start.line <= line && n.loc.end.line >= line) {
        // deepest/smallest range wins
        if (
          !bestPath ||
          (n.loc.end.line - n.loc.start.line) <
            (bestPath.node.loc.end.line - bestPath.node.loc.start.line)
        ) {
          bestPath = p;
        }
      }
    },
  });

  if (!bestPath) return null;

  // Helpers
  const getLeadingComments = (node) =>
    (node.leadingComments || []).map((c) => c.value);

  const hasMetaAction = (node) => {
    const comments = getLeadingComments(node);
    return comments.some((c) => /@pja\.meta\(([^)]*)\)/.test(c) && /TYPE\s*=\s*"ACTION"/i.test(c));
  };

  const idOrPropName = (p) => {
    const n = p.node;
    if (t.isFunctionDeclaration(n) && n.id) return n.id.name;
    if (t.isFunctionExpression(n) && t.isIdentifier(n.id)) return n.id.name;
    if (t.isArrowFunctionExpression(n)) {
      // try LHS if assigned
      const parent = p.parentPath && p.parentPath.node;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name;
      if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) return parent.left.name;
      if (t.isObjectProperty(parent)) {
        if (t.isIdentifier(parent.key)) return parent.key.name;
        if (t.isStringLiteral(parent.key)) return parent.key.value;
      }
      if (t.isClassProperty(parent) && t.isIdentifier(parent.key)) return parent.key.name;
    }
    if (t.isClassMethod(n) || t.isObjectMethod(n)) {
      if (t.isIdentifier(n.key)) return n.key.name;
      if (t.isStringLiteral(n.key)) return n.key.value;
    }
    return null;
  };

  const looksLikeLoggerIdent = (name) =>
    !!name && /\b(log|logger|debug|trace|audit)\b/i.test(name);

  const isLoggerCallee = (callee) => {
    // logger.xxx(..) or console.xxx(..)
    if (t.isIdentifier(callee) && looksLikeLoggerIdent(callee.name)) return true;
    if (t.isMemberExpression(callee)) {
      const obj = callee.object;
      if (t.isIdentifier(obj) && (obj.name === "logger" || obj.name === "console")) return true;
      if (t.isIdentifier(obj) && looksLikeLoggerIdent(obj.name)) return true;
    }
    return false;
  };

  const bodyIsOnlyLogging = (fnNode) => {
    const stmts = t.isBlockStatement(fnNode.body) ? fnNode.body.body : [fnNode.body].filter(Boolean);
    if (!stmts.length) return false;
    // allow "return logger.xxx(...)" or "logger.xxx(...); return ..." with no other logic
    return stmts.every((s) => {
      if (t.isExpressionStatement(s) && t.isCallExpression(s.expression)) {
        return isLoggerCallee(s.expression.callee);
      }
      if (t.isReturnStatement(s) && s.argument && t.isCallExpression(s.argument)) {
        return isLoggerCallee(s.argument.callee);
      }
      return false;
    });
  };

  const looksSemanticName = (name) =>
    !!name && /\b(action|handler|route|job|task|command|controller|resolver|service)\b/i.test(name);

  const isFunctionLike = (p) =>
    p && (
      t.isFunctionDeclaration(p.node) ||
      t.isFunctionExpression(p.node) ||
      t.isArrowFunctionExpression(p.node) ||
      t.isClassMethod(p.node) ||
      t.isObjectMethod(p.node)
    );

  const isActionScope = (p) => {
    if (!isFunctionLike(p)) return false;
    if (hasMetaAction(p.node)) return true;

    const name = idOrPropName(p);
    if (looksSemanticName(name) && !bodyIsOnlyLogging(p.node)) return true;

    // property path heuristics: obj like { actions: { foo() {} } } or routes: { ... }
    const parent = p.parentPath;
    if (parent && (t.isObjectProperty(parent.node) || t.isClassProperty(parent.node))) {
      const key = parent.node.key;
      const keyName = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null;
      if (/\b(actions?|handlers?|routes?)\b/i.test(keyName || "")) return !bodyIsOnlyLogging(p.node);
    }

    return false;
  };

  // Add library context detection
  const libraryContext = identifyLibraryContext(bestPath.node);

  // start from the smallest covering node; get its function parent
  let cursor = bestPath.getFunctionParent() || bestPath;

  // climb until we hit an action scope or run out
  let candidate = null;
  while (cursor) {
    if (isFunctionLike(cursor) && !bodyIsOnlyLogging(cursor.node)) {
      candidate = cursor; // remember last non-logging function
      if (isActionScope(cursor)) break;
    }
    cursor = cursor.parentPath;
  }

  const target = isActionScope(cursor) ? cursor : candidate;

  if (!target) return null;

  // summarize
  const loc = target.node.loc;
  return {
    file: abs,
    actionName: idOrPropName(target) || "<anonymous>",
    kind: target.node.type,
    startLine: loc?.start.line,
    endLine: loc?.end.line,
    metaAction: hasMetaAction(target.node),
    libraryContext: libraryContext  // Add library context information
  };
}

module.exports = { findEnclosingAction };

/* Example:
const { findEnclosingAction } = require('./find-action');
findEnclosingAction('./server/api/foo.js', 137).then(console.log);
*/
