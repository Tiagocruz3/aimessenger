import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Copy, ThumbsUp, ThumbsDown, RotateCcw, Check, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SearchResultsView = ({ summary, results = [], query }) => {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
        <p className="text-[10px] uppercase tracking-wide text-primary/70">Summary</p>
        <p className="mt-1 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{summary}</p>
        {query && (
          <p className="mt-2 text-[11px] text-text-secondary/80">
            Query: <span className="text-text-secondary">{query}</span>
          </p>
        )}
      </div>
      {results.map((result) => {
        return (
          <div
            key={`${result.url}-${result.index}`}
            className="rounded-2xl border border-border/60 bg-surface/40 p-4 shadow-sm backdrop-blur"
          >
            <div className="flex flex-col gap-4 md:flex-row">
              {result.thumbnail && (
                <div className="md:w-40 md:flex-shrink-0">
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-black/20">
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="flex-1">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-sky-300 hover:text-sky-200 transition-colors"
                >
                  {result.index}. {result.title}
                </a>
                <p className="mt-1 text-xs text-emerald-400 break-all">{result.url}</p>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {result.snippet}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-black/10 p-3">
              <p className="text-xs text-text-secondary/80">
                Use the link above to view the site in a new tab. Many publishers block embedded previews, so we disable them here for a smoother experience.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ImageSearchResultsView = ({ heading, results = [], query }) => {
  const hasResults = Array.isArray(results) && results.length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
        <p className="text-[10px] uppercase tracking-wide text-primary/70">Image Search</p>
        {heading && (
          <p className="mt-1 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{heading}</p>
        )}
        {query && (
          <p className="mt-2 text-[11px] text-text-secondary/80">
            Query: <span className="text-text-secondary">{query}</span>
          </p>
        )}
      </div>

      {hasResults ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((result) => {
            if (!result.imageUrl) {
              return null;
            }

            const href = result.url || result.imageUrl;
            return (
              <a
                key={`${result.imageUrl}-${result.index}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-black/30"
                title={result.title}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={result.imageUrl}
                    alt={result.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <p className="text-sm font-medium text-text truncate">
                    {result.title}
                  </p>
                  {result.source && (
                    <p className="text-xs text-text-secondary truncate">
                      {result.source}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-surface/40 p-4 text-sm text-text-secondary">
          No images to display for this search.
        </div>
      )}
    </div>
  );
};

function Message({ message, model, onRetry, showModelLabel = false, isGrouped = false }) {
  // Hooks must be called unconditionally at the top-level on every render
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(null);

  // Validate message after hooks to keep hooks order stable across renders
  if (!message) {
    return null;
  }

  // Show generating image message (before regular rendering)
  if (message.isGeneratingImage) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start mb-4"
      >
        <div className="flex gap-3 max-w-[85%]">
          {model && (
            <img
              src={model.avatar}
              alt={model.name || 'AI'}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.target.src = 'https://images.pexels.com/photos/8566472/pexels-photo-8566472.jpeg?w=400';
              }}
            />
          )}
          <div className="flex-1">
            <div className="bg-surface-light px-5 py-4 rounded-2xl">
              <p className="text-sm text-text-secondary">
                <span className="animate-pulse">Generating image...</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Don't render typing messages or invalid messages
  if (message.isTyping || !message.content) {
    return null;
  }

  const isUser = message.sender === 'user';
  const content = message.content || '';
  const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
  const isSearchResults = message.type === 'search_results' && Array.isArray(message.searchResults);
  const isImageSearchResults = message.type === 'image_search_results' && Array.isArray(message.searchResults);

  // Safe timestamp formatting
  let timeAgo = 'just now';
  try {
    if (!isNaN(timestamp.getTime())) {
      timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });
    }
  } catch (error) {
    console.error('Error formatting timestamp:', error);
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    if (!liked) setDisliked(false);
    toast.success(liked ? 'Like removed' : 'Feedback sent!');
  };

  const handleDislike = () => {
    setDisliked(!disliked);
    if (!disliked) setLiked(false);
    toast.success(disliked ? 'Dislike removed' : 'Feedback sent!');
  };

  const handleRetry = () => {
    if (onRetry && !isUser) {
      onRetry();
    }
  };

  const createImageFileName = (altText = '', url = '') => {
    const defaultName = 'generated-image.png';
    if (altText) {
      const slug = altText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
      if (slug) {
        return `${slug}.png`;
      }
    }

    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.split('/').filter(Boolean).pop();
      if (pathname) {
        const hasExtension = /\.[a-z0-9]{2,5}$/i.test(pathname);
        return hasExtension ? pathname : `${pathname}.png`;
      }
    } catch (error) {
      // Ignore parsing errors and use default
    }

    return defaultName;
  };

  const handleImageDownload = async (url, altText) => {
    if (!url || downloadingImage === url) {
      return;
    }

    const fileName = createImageFileName(altText, url);

    try {
      setDownloadingImage(url);

      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Image downloaded');
        return;
      }

      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast.success('Image downloaded');
    } catch (error) {
      console.error('Image download failed:', error);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.error('Direct download blocked. Opened image in a new tab.');
    } finally {
      setDownloadingImage(null);
    }
  };

  const outerClassName = `flex ${isUser ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mb-0 h-full' : 'mb-4'}`;
  const innerWrapperClass = `flex gap-3 w-full ${isUser ? 'flex-row-reverse' : ''} ${isGrouped ? 'h-full' : ''}`;
  const contentWrapperClass = `${isGrouped ? 'flex-1 flex ' : 'flex-1'} ${isUser ? 'justify-end' : ''} ${isGrouped ? 'h-full' : ''}`;
  const widthClass = isGrouped
    ? 'w-full max-w-none h-full flex flex-col'
    : isUser
      ? 'max-w-[80%]'
      : 'max-w-[85%]';
  const bubbleClass = `${
    isUser 
      ? 'bg-primary text-white px-4 py-3 shadow-sm' 
      : 'bg-surface-light px-5 py-4 shadow-sm'
  } ${isGrouped ? 'flex-1 flex flex-col h-full' : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={outerClassName}
    >
      <div className={innerWrapperClass}>
        {!isUser && model && (
          <img
            src={model.avatar}
            alt={model.name || 'AI'}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            onError={(e) => {
              e.target.src = 'https://images.pexels.com/photos/8566472/pexels-photo-8566472.jpeg?w=400';
            }}
          />
        )}
        
        <div className={contentWrapperClass}>
          <div className={widthClass}>
            {!isUser && model && showModelLabel && (
              <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-[0.25em] text-text-secondary/80">
                <span className="flex-1 h-px bg-border/40" />
                <span>{model.name}</span>
                <span className="flex-1 h-px bg-border/40" />
              </div>
            )}
            <div className={`relative rounded-2xl ${bubbleClass}`}>
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                {isSearchResults ? (
                  <SearchResultsView
                    summary={content}
                    results={message.searchResults}
                    query={message.searchQuery}
                  />
                ) : isImageSearchResults ? (
                  <ImageSearchResultsView
                    heading={content}
                    results={message.searchResults}
                    query={message.searchQuery}
                  />
                ) : (
                  <ReactMarkdown
                    components={{
                    // Custom code block rendering - as a card
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const language = match ? match[1] : '';
                      
                      return !inline && language ? (
                        <div className="code-card my-4">
                          <div className="code-card-header">
                            <span className="code-card-language">{language}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(String(children));
                                toast.success('Code copied!');
                              }}
                              className="code-copy-btn"
                              title="Copy code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="code-card-content">
                            <pre>
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <code className="inline-code" {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre({ children }) {
                      return <>{children}</>;
                    },
                    // Images as cards
                    img({ src, alt, ...props }) {
                      return (
                        <div className="image-card my-4 group">
                          <button
                            type="button"
                            onClick={() => handleImageDownload(src, alt)}
                            className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-black/70 p-2 text-white transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            title="Download image"
                            disabled={downloadingImage === src}
                          >
                            {downloadingImage === src ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                          <img
                            src={src}
                            alt={alt}
                            className="image-card-img"
                            {...props}
                          />
                          {alt && (
                            <div className="image-card-caption">{alt}</div>
                          )}
                        </div>
                      );
                    },
                    p({ children, ...props }) {
                      // Check if paragraph only contains an image
                      const childrenArray = React.Children.toArray(children);
                      const hasImage = childrenArray.some(
                        child => {
                          if (React.isValidElement(child)) {
                            // Check if it's an img tag or if it contains an image card
                            return child.type === 'img' || 
                                   (child.props && child.props.className && child.props.className.includes('image-card'));
                          }
                          return false;
                        }
                      );
                      if (hasImage) {
                        return <>{children}</>;
                      }
                      return <p className="message-text" {...props}>{children}</p>;
                    },
                    h1({ children }) {
                      return <h1 className="message-heading message-heading-1">{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 className="message-heading message-heading-2">{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 className="message-heading message-heading-3">{children}</h3>;
                    },
                    ul({ children }) {
                      return <ul className="message-list">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="message-list message-list-ordered">{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="message-list-item">{children}</li>;
                    },
                    strong({ children }) {
                      return <strong className="message-bold">{children}</strong>;
                    },
                    blockquote({ children }) {
                      return <blockquote className="message-quote">{children}</blockquote>;
                    },
                    // Table as card
                    table({ children }) {
                      return (
                        <div className="table-card my-4">
                          <table className="message-table">{children}</table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return <th className="message-table-header">{children}</th>;
                    },
                    td({ children }) {
                      return <td className="message-table-cell">{children}</td>;
                    },
                  }}
                  >
                    {content}
                  </ReactMarkdown>
                )}
              </div>
            )}

            {/* Action buttons for AI messages */}
            {!isUser && (
              <div className={`flex items-center gap-1 mt-3 pt-3 border-t border-border/30 ${isGrouped ? 'justify-end' : ''}`}>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded hover:bg-surface transition-colors group"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-text-secondary group-hover:text-text transition-colors" />
                  )}
                </button>
                <button
                  onClick={handleLike}
                  className={`p-1.5 rounded hover:bg-surface transition-colors group ${
                    liked ? 'text-success' : ''
                  }`}
                  title="Like"
                >
                  <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-current' : 'text-text-secondary group-hover:text-text'} transition-colors`} />
                </button>
                <button
                  onClick={handleDislike}
                  className={`p-1.5 rounded hover:bg-surface transition-colors group ${
                    disliked ? 'text-error' : ''
                  }`}
                  title="Dislike"
                >
                  <ThumbsDown className={`w-4 h-4 ${disliked ? 'fill-current' : 'text-text-secondary group-hover:text-text'} transition-colors`} />
                </button>
                {onRetry && (
                  <button
                    onClick={handleRetry}
                    className="ml-auto px-3 py-1.5 rounded-lg hover:bg-surface transition-colors text-xs text-text-secondary hover:text-text flex items-center gap-1.5"
                    title="Retry"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
          <p className={`text-xs text-text-secondary mt-1.5 px-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}>
            {timeAgo}
          </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const messagePropsAreEqual = (prev, next) => {
  if (prev.showModelLabel !== next.showModelLabel) return false;
  if (prev.isGrouped !== next.isGrouped) return false;

  const prevModelId = prev.model?.id || null;
  const nextModelId = next.model?.id || null;
  if (prevModelId !== nextModelId) return false;

  const prevMessage = prev.message;
  const nextMessage = next.message;

  if (prevMessage === nextMessage) {
    return true;
  }

  if (!prevMessage || !nextMessage) {
    return false;
  }

  const keysToCompare = [
    'id',
    'content',
    'sender',
    'timestamp',
    'type',
    'modelId',
    'responseGroupId',
    'isTyping',
    'isGeneratingImage',
    'searchQuery',
  ];

  for (const key of keysToCompare) {
    if (prevMessage[key] !== nextMessage[key]) {
      return false;
    }
  }

  const prevResults = prevMessage.searchResults;
  const nextResults = nextMessage.searchResults;

  if (Array.isArray(prevResults) || Array.isArray(nextResults)) {
    if (!Array.isArray(prevResults) || !Array.isArray(nextResults)) {
      return false;
    }
    if (prevResults.length !== nextResults.length) {
      return false;
    }
  }

  return true;
};

export default memo(Message, messagePropsAreEqual);
