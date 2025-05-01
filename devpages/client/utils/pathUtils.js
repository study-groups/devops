export function pathJoin(...parts) {
    // Filter out empty, null, undefined, or root slash parts
    const filteredParts = parts.filter(part => part && typeof part === 'string' && part !== '/');
    if (filteredParts.length === 0) return ''; // Return empty string if no valid parts

    // Join with slash
    let joined = filteredParts.join('/');

    // Remove duplicate slashes (more robustly)
    joined = joined.replace(/\/+/g, '/');

    // Remove leading/trailing slashes for internal consistency
    // Let callers add them back if needed for specific URLs/display
    joined = joined.replace(/^\/|\/$/g, '');

    return joined;
}

export function getParentPath(pathname) {
  if (!pathname || typeof pathname !== 'string') {
    // Return empty string for invalid input or if already at root
    return '';
  }
  // Remove trailing slash if exists, except if it's the only character (root '/')
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  // Handle root case explicitly
  if (normalizedPath === '/' || normalizedPath === '') {
      return ''; // Parent of root or empty is empty
  }

  const lastSlashIndex = normalizedPath.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    // No slash found, must be a top-level item
    return ''; // Parent is the root, represented by empty string
  } else if (lastSlashIndex === 0) {
    // Path like "/toplevel" (shouldn't happen with our pathJoin, but handle defensively)
    // Parent is the root
    return '';
  } else {
    // Standard case: "a/b/c" -> "a/b"
    return normalizedPath.substring(0, lastSlashIndex);
  }
}

export function getFilename(pathname) {
   if (!pathname || typeof pathname !== 'string') {
    return ''; // Return empty string for invalid input
  }
  // Remove trailing slash if exists
  const normalizedPath = pathname.replace(/\/$/, '');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    // No slash, the whole thing is the filename (or directory name if it's top-level)
    return normalizedPath;
  } else {
    // Get the part after the last slash
    return normalizedPath.substring(lastSlashIndex + 1);
  }
}

// Remove duplicate pathJoin2 if it exists
