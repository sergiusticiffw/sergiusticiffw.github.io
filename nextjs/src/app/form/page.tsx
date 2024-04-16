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
        const { data: { links: { self } } } = await response.json();
        if (self) {
          const analysis = await fetch(self, {
            method: 'GET',
            headers: {
              'x-apikey': apiKey,
              'Accept': 'application/json',
            },
          });
          const { data: { attributes } } = await analysis.json();

          console.log(attributes);
        }
      } catch (e) {
        console.error(e);
      }

      const cloudmersive = await fetch('https://api.cloudmersive.com/virus/scan/file', {
        method: 'POST',
        headers: {
          'Apikey': 'e4bee107-0e31-4e34-90a0-542541b1ef29',
          'Accept': 'application/json',
        },
        body: formData,
      });
      const cloudmersivedata = await cloudmersive.json();
      console.log(1, cloudmersivedata);
    };

    const upload = async () => {
      // const apiKeyH = 'eu1-55b4-6d4c-40c2-b9c3-5e7b62c5f54d';
      // const postUrlfolder = 'https://api.hubspot.com/files/v3/folders?hapikey=' + apiKeyH;
      //
      // const body = {
      //   name: 'testFolder',
      //   parentPath: '/path/to/parent/folder',
      // };
      //
      // const responseFolder = await fetch(postUrlfolder, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${apiKeyH}`,
      //   },
      //   body: JSON.stringify(body)
      // });
      //
      // const dataFolder = await responseFolder.json();
      // console.log(1, responseFolder)
      // console.log(2, dataFolder);

      const fileOptions = {
        access: 'PUBLIC_INDEXABLE',
        ttl: 'P3M',
        overwrite: true,
        duplicateValidationStrategy: 'NONE',
        duplicateValidationScope: 'ENTIRE_PORTAL',
      };
      formData.append('options', JSON.stringify(fileOptions));
      formData.append('folderId', '99786270969');

      const postUrl = 'https://api.hubapi.com/filemanager/api/v3/files/upload?hapikey=eu1-55b4-6d4c-40c2-b9c3-5e7b62c5f54d';
      const response = await fetch(postUrl, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.objects[0]) {
        const furl = data.objects[0].s3_url;
      const hubspotUrl = 'https://api.hsforms.com/submissions/v3/integration/submit/144507663/af3c0965-a011-436d-a293-4e3afb3d9a4f';
      const dataForm = {
        fields: [
          {
            "objectTypeId": "0-1",
            "name": "email",
            "value": "example@example.com"
          },
          {
            "objectTypeId": "0-1",
            "name": "firstname",
            "value": "Jeff"
          },
          {
            "objectTypeId": "0-1",
            "name": "lastname",
            "value": "Jeff"
          },
          {
            "objectTypeId": "0-1",
            "name": "file",
            "value": furl
          }
        ]
        };

      const jsonBody = JSON.stringify(dataForm);
        const formRes = await fetch(hubspotUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eu1-55b4-6d4c-40c2-b9c3-5e7b62c5f54d`,
          },
          body: jsonBody,
        });
        const formD = await formRes.json()
        console.log(91, formD)
      }
    };


    const file = formData.get('file');

    if (file) {
      scanFile(file)
      upload();
    }
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
  );
}

export default Form;
