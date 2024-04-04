import React from 'react';

const Form = () => {
  const handleSubmit = async (formData: FormData) => {
    'use server';

    const apiKey = 'fb353c5ceb5b61095050b25fb22d0e4055227e8dd1cfd14b18ebec5f64deb51b'; // Replace with your actual API key
    const scanFile = async (file) => {
      try {
        const response = await fetch('https://www.virustotal.com/api/v3/files', {
          method: 'POST',
          headers: {
            'x-apikey': apiKey,
            'Accept': 'application/json',
          },
          body: formData,
        });
        const { data: {links: {self}} } = await response.json();
        if (self) {
          const analysis = await fetch(self, {
            method: 'GET',
            headers: {
              'x-apikey': apiKey,
              'Accept': 'application/json',
            },
          });
          const { data: {attributes} } = await analysis.json();

          console.log(attributes)
        }
      } catch (e) {
        console.error(e)
      }
    }

    const file = formData.get('file');

    if (file) scanFile(file)
  };

  return (
    <>
      <h1>test</h1>
      {/* @ts-ignore */}
      <form action={handleSubmit}>
        <input name="file" type="file" />
        <br />
        <button type="submit">save</button>
      </form>
    </>
  )
}

export default Form;
