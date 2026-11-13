document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('id_target_type')
  if (!picker) return

  const postRow = document.querySelector('.form-row.field-post')
  const commentRow = document.querySelector('.form-row.field-comment')
  const authorRow = document.querySelector('.form-row.field-target_author')
  const authorIsEditable = authorRow && authorRow.querySelector('select')

  function update() {
    const type = picker.value
    if (postRow) postRow.style.display = type === 'post' ? '' : 'none'
    if (commentRow) commentRow.style.display = type === 'comment' ? '' : 'none'
    if (authorIsEditable) authorRow.style.display = type === 'profile' ? '' : 'none'
  }

  picker.addEventListener('change', update)
  update()
})