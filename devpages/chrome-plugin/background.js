chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    const urls = tabs.map(tab => tab.url).join('\n');
    const encoded = encodeURIComponent(urls);
    const dataUrl = `data:text/plain;charset=utf-8,${encoded}`;

    chrome.downloads.download({
      url: dataUrl,
      filename: 'tab-urls.txt',
      saveAs: true
    });
  });
});

