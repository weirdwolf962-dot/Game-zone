# How to Add Crew Avatar Images

Drop your 5 images into this folder with these exact filenames:

  rayyan.png
  arsh.png
  rajandeep.png
  sudhin.png
  prajwal.png

Any format works: .png / .jpg / .webp
Recommended size: 200x200px or higher, square crop works best.

After adding images, open:
  src/components/auth/AvatarPicker.jsx

And update the CREW_AVATARS array at the top:

  { id: 'crew_0', techyName: 'R4YY4N',   realName: 'Rayyan',    image: '/avatars/rayyan.png',    initials: 'RY' },
  { id: 'crew_1', techyName: '4R5H',      realName: 'Arsh',      image: '/avatars/arsh.png',      initials: 'AR' },
  { id: 'crew_2', techyName: 'R4J4.EXE', realName: 'Rajandeep', image: '/avatars/rajandeep.png', initials: 'RJ' },
  { id: 'crew_3', techyName: '5UDH1N',   realName: 'Sudhin',    image: '/avatars/sudhin.png',    initials: 'SD' },
  { id: 'crew_4', techyName: 'PR4JW4L',  realName: 'Prajwal',   image: '/avatars/prajwal.png',   initials: 'PJ' },

Then git add, commit, push — Vercel auto-redeploys!
