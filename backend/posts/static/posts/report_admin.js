document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('id_target_type')
  if (!picker) return

  const postRow = document.querySelector('.form-row.field-post')
  const commentRow = document.querySelector('.form-row.field-comment')

  function update() {
    const isComment = picker.value === 'comment'
    if (postRow) postRow.style.display = isComment ? 'none' : ''
    if (commentRow) commentRow.style.display = isComment ? '' : 'none'
  }

  picker.addEventListener('change', update)
  update()
})
