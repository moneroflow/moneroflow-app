const copyLink = (link) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    const fullUrl = `${baseUrl}/pay/${link.id}_${link.slug}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('Full payment link copied!');
  }
};

const buildPayUrl = (link) => {
  return `${baseUrl}/pay/${link.id}_${link.slug}`;
};
