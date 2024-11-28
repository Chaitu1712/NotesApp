
function initQuill(containerId, options) {
    return new Quill(containerId, {
        theme: 'snow',
        modules: {
            toolbar: options.toolbar || [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'header': 1 }, { 'header': 2 }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['clean']
            ]
        }
    });
}

module.exports = { initQuill };