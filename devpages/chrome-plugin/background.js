chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    const urls = tabs.map(tab => tab.url).join('\n');
    const blob = new Blob([urls], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: 'tab-urls.txt',
      saveAs: true
    });
  });
});
